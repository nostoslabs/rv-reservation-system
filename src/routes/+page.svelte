<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ParkingLocationsPanel from '$lib/components/ParkingLocationsPanel.svelte';
  import ReservationModal from '$lib/components/ReservationModal.svelte';
  import {
    addDays,
    diffDays,
    formatDisplayDate,
    formatLocalTimestamp,
    getTodayIsoLocal
  } from '$lib/date';
  import { buildCellId, buildOccupancyMap } from '$lib/reservations';
  import { STATUS_BG_COLORS, STATUS_COLORS, STATUS_LABELS } from '$lib/domain/reservations/status';
  import { siteSettingsStore } from '$lib/site-settings';
  import { rvReservationStore } from '$lib/state';
  import { RESERVATION_STATUSES, type Reservation, type ReservationFormValues } from '$lib/types';

  const FIRST_COLUMN_WIDTH = 220;
  const DATE_COLUMN_WIDTH = 128;
  const DAYS_BEFORE_TODAY = 45;
  const TOTAL_DATE_COLUMNS = 540;

  const todayIso = getTodayIsoLocal();
  const gridStartDate = addDays(todayIso, -DAYS_BEFORE_TODAY);
  const dateColumns = Array.from({ length: TOTAL_DATE_COLUMNS }, (_, index) => addDays(gridStartDate, index));

  let gridScroller: HTMLDivElement | null = null;
  let nowMs = Date.now();
  let locationPanelError = '';
  let occupancyMap: Map<string, Reservation> = new Map();
  let reservationCountsByLocation: Record<string, number> = {};
  let autosaveStatus = 'Autosave pending';

  let modalOpen = false;
  let modalMode: 'create' | 'edit' = 'create';
  let modalErrors: string[] = [];
  let modalDraft: ReservationFormValues = {
    name: '',
    phoneNumber: '',
    notes: '',
    startDate: todayIso,
    endDate: addDays(todayIso, 1),
    parkingLocation: '',
    color: 'blue',
    status: 'reserved'
  };

  // Toast notification state
  let toastMessage = '';
  let toastVisible = false;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string): void {
    toastMessage = message;
    toastVisible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible = false;
      toastTimer = null;
    }, 3000);
  }

  $: occupancyMap = buildOccupancyMap($rvReservationStore.reservations);
  $: reservationCountsByLocation = Object.fromEntries(
    $rvReservationStore.parkingLocations.map((location) => [
      location,
      $rvReservationStore.reservations.filter((reservation) => reservation.parkingLocation === location).length
    ])
  ) as Record<string, number>;
  $: autosaveStatus = getAutosaveStatus($rvReservationStore.lastSavedAt, nowMs);

  function getAutosaveStatus(lastSavedAt: number | null, nowTimestamp: number): string {
    if (!lastSavedAt) return 'Autosave pending';
    const ageMs = Math.max(0, nowTimestamp - lastSavedAt);
    const ageMinutes = Math.floor(ageMs / 60000);
    if (ageMinutes <= 0) {
      return `Saved just now (${formatLocalTimestamp(lastSavedAt)})`;
    }
    if (ageMinutes === 1) {
      return `Saved 1 minute ago (${formatLocalTimestamp(lastSavedAt)})`;
    }
    if (ageMinutes < 60) {
      return `Saved ${ageMinutes} minutes ago (${formatLocalTimestamp(lastSavedAt)})`;
    }
    const ageHours = Math.floor(ageMinutes / 60);
    return `Saved ${ageHours}h ago (${formatLocalTimestamp(lastSavedAt)})`;
  }

  async function alignToToday(): Promise<void> {
    await tick();
    if (!gridScroller) return;
    const todayIndex = diffDays(gridStartDate, todayIso);
    const targetHeader = gridScroller.querySelector<HTMLTableCellElement>(
      `th.date-header[data-date="${todayIso}"]`
    );
    const rawOffset = targetHeader
      ? Math.max(0, targetHeader.offsetLeft - FIRST_COLUMN_WIDTH)
      : todayIndex * DATE_COLUMN_WIDTH;
    const maxOffset = Math.max(0, gridScroller.scrollWidth - gridScroller.clientWidth);
    gridScroller.scrollLeft = Math.min(Math.max(0, rawOffset), maxOffset);
  }

  function scrollWeek(direction: number): void {
    gridScroller?.scrollBy({ left: DATE_COLUMN_WIDTH * 7 * direction, behavior: 'smooth' });
  }

  function openModalForCell(parkingLocation: string, dateIso: string): void {
    const reservation = occupancyMap.get(buildCellId(parkingLocation, dateIso));

    if (reservation) {
      modalMode = 'edit';
      modalDraft = {
        index: reservation.index,
        name: reservation.name,
        phoneNumber: reservation.phoneNumber,
        notes: reservation.notes,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        parkingLocation: reservation.parkingLocation,
        color: reservation.color,
        status: reservation.status
      };
    } else {
      modalMode = 'create';
      modalDraft = {
        name: '',
        phoneNumber: '',
        notes: '',
        startDate: dateIso,
        endDate: addDays(dateIso, 1),
        parkingLocation,
        color: 'blue',
        status: 'reserved'
      };
    }

    modalErrors = [];
    modalOpen = true;
  }

  function closeModal(): void {
    modalOpen = false;
    modalErrors = [];
  }

  function handleModalSave(event: CustomEvent<ReservationFormValues>): void {
    const result = rvReservationStore.saveReservation(event.detail);
    if (!result.ok) {
      modalErrors = result.errors;
      return;
    }

    closeModal();
    showToast('Reservation saved');
  }

  function handleModalDelete(event: CustomEvent<{ index: number }>): void {
    const result = rvReservationStore.deleteReservation(event.detail.index);
    if (!result.ok) {
      modalErrors = result.errors;
      return;
    }

    closeModal();
    showToast('Reservation deleted');
  }

  function applyLocationMutation(result: { ok: boolean; errors?: string[] }, successMsg?: string): void {
    if (result.ok) {
      locationPanelError = '';
      if (successMsg) showToast(successMsg);
      return;
    }
    locationPanelError = result.errors?.[0] ?? 'Unable to update parking locations.';
  }

  function handleAddLocation(event: CustomEvent<{ name: string }>): void {
    applyLocationMutation(rvReservationStore.addParkingLocation(event.detail.name), 'Location added');
  }

  function handleRenameLocation(event: CustomEvent<{ oldName: string; newName: string }>): void {
    applyLocationMutation(
      rvReservationStore.renameParkingLocation(event.detail.oldName, event.detail.newName),
      'Location renamed'
    );
  }

  function handleDeleteLocation(event: CustomEvent<{ name: string }>): void {
    applyLocationMutation(rvReservationStore.deleteParkingLocation(event.detail.name), 'Location deleted');
  }

  function getReservationCellTitle(location: string, dateIso: string, reservation?: Reservation): string {
    if (!reservation) {
      return `Click to add reservation at ${location} on ${dateIso}`;
    }

    const lines = [
      `${reservation.name} (${reservation.startDate} \u2192 ${reservation.endDate})`,
      `Location: ${reservation.parkingLocation}`,
      `Status: ${STATUS_LABELS[reservation.status]}`
    ];

    if (reservation.phoneNumber) {
      lines.push(`Phone: ${reservation.phoneNumber}`);
    }

    if (reservation.notes) {
      lines.push(`Notes: ${reservation.notes}`);
    }

    return lines.join('\n');
  }

  function saveNow(): void {
    rvReservationStore.forceSave();
    nowMs = Date.now();
  }

  onMount(() => {
    rvReservationStore.hydrate();
    siteSettingsStore.hydrate();
    void alignToToday();
    const alignTimeout = window.setTimeout(() => void alignToToday(), 80);

    const displayTicker = window.setInterval(() => {
      nowMs = Date.now();
    }, 60_000);

    const autosaveTicker = window.setInterval(() => {
      rvReservationStore.forceSave();
      nowMs = Date.now();
    }, 15 * 60_000);

    const handleBeforeUnload = (): void => {
      rvReservationStore.forceSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearTimeout(alignTimeout);
      window.clearInterval(displayTicker);
      window.clearInterval(autosaveTicker);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (toastTimer) clearTimeout(toastTimer);
    };
  });
</script>

<svelte:head>
  <title>{$siteSettingsStore.siteName}</title>
  <meta
    name="description"
    content="Spreadsheet-style RV reservation working sheet with localStorage persistence."
  />
</svelte:head>

<div class="page-shell">
  <header class="toolbar">
    <div class="toolbar-left">
      <h1>{$siteSettingsStore.siteName}</h1>
    </div>

    <nav class="toolbar-center" aria-label="Grid navigation">
      <button type="button" class="nav-btn" on:click={() => scrollWeek(-1)} aria-label="Previous week">&#8592;</button>
      <button type="button" class="nav-btn primary" on:click={alignToToday}>Today</button>
      <button type="button" class="nav-btn" on:click={() => scrollWeek(1)} aria-label="Next week">&#8594;</button>
    </nav>

    <div class="toolbar-right">
      <span class="badge">{$rvReservationStore.reservations.length} res</span>
      <span class="badge">{$rvReservationStore.parkingLocations.length} sites</span>
      <span class="autosave-badge" aria-live="polite" title={autosaveStatus}>
        {autosaveStatus}
      </span>
      <button type="button" class="save-btn" on:click={saveNow}>Save</button>
      <a href="/admin" class="settings-link" title="Settings" aria-label="Settings" data-testid="settings-link">
        <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="20" height="20">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </a>
    </div>
  </header>

  <div class="layout-grid">
    <aside>
      <ParkingLocationsPanel
        locations={$rvReservationStore.parkingLocations}
        reservationCounts={reservationCountsByLocation}
        errorMessage={locationPanelError}
        on:add={handleAddLocation}
        on:rename={handleRenameLocation}
        on:remove={handleDeleteLocation}
        on:clearerror={() => (locationPanelError = '')}
      />
    </aside>

    <section class="sheet-panel" aria-labelledby="working-sheet-title">
      <h2 id="working-sheet-title" class="sr-only">Working Sheet</h2>

      <div class="status-legend" data-testid="status-legend" aria-label="Status legend">
        {#each RESERVATION_STATUSES as status}
          <span class="legend-item">
            <span class="legend-dot" style="background: {STATUS_COLORS[status]}"></span>
            {STATUS_LABELS[status]}
          </span>
        {/each}
      </div>

      <div class="sheet-scroll" bind:this={gridScroller}>
        <table class="sheet-table" aria-label="RV reservation working sheet">
          <colgroup>
            <col class="first-col" />
            {#each dateColumns as _date}
              <col class="date-col" />
            {/each}
          </colgroup>

          <thead>
            <tr class="calendar-row">
              <th class="sticky-row1 sticky-col top-left-cell location-header" scope="col">
                <div class="top-left-content">
                  <span class="label">Current Date</span>
                  <strong>{formatDisplayDate(todayIso)}</strong>
                </div>
              </th>
              {#each dateColumns as dateIso}
                <th
                  class="sticky-row1 date-header"
                  class:today={dateIso === todayIso}
                  scope="col"
                  data-date={dateIso}
                >
                  {formatDisplayDate(dateIso)}
                </th>
              {/each}
            </tr>
          </thead>

          <tbody>
            {#each $rvReservationStore.parkingLocations as location}
              <tr>
                <th class="sticky-col location-cell" scope="row">{location}</th>
                {#each dateColumns as dateIso}
                  {@const cellId = buildCellId(location, dateIso)}
                  {@const reservation = occupancyMap.get(cellId)}
                  <td
                    class={`grid-cell ${reservation ? 'occupied' : 'empty'} ${dateIso === todayIso ? 'today' : ''}`}
                    style={reservation ? `background: ${STATUS_BG_COLORS[reservation.status]}` : ''}
                    on:click={() => openModalForCell(location, dateIso)}
                    title={getReservationCellTitle(location, dateIso, reservation)}
                  >
                    {#if reservation}
                      <span class="reservation-label">{reservation.name}</span>
                    {:else}
                      <span class="empty-hint" aria-hidden="true">+</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </div>
</div>

{#if toastVisible}
  <div class="toast" role="status" aria-live="polite">{toastMessage}</div>
{/if}

<ReservationModal
  open={modalOpen}
  mode={modalMode}
  draft={modalDraft}
  errors={modalErrors}
  parkingLocations={$rvReservationStore.parkingLocations}
  on:save={handleModalSave}
  on:cancel={closeModal}
  on:delete={handleModalDelete}
/>

<style>
  .page-shell {
    padding: 0.5rem 1rem 1rem;
    display: grid;
    gap: 0.5rem;
  }

  /* -- Compact operations toolbar -- */
  .toolbar {
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 0.4rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    backdrop-filter: blur(6px);
    min-height: 48px;
    flex-wrap: wrap;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  h1 {
    margin: 0;
    font-size: clamp(0.95rem, 1.5vw + 0.5rem, 1.25rem);
    white-space: nowrap;
  }

  .toolbar-center {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .nav-btn {
    border-radius: 8px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    color: #223349;
    padding: 0.3rem 0.65rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    min-height: 34px;
    line-height: 1;
  }

  .nav-btn:hover {
    background: #edf3fd;
  }

  .nav-btn.primary {
    background: #0a63e0;
    border-color: #0a63e0;
    color: white;
  }

  .nav-btn.primary:hover {
    background: #0757c8;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: auto;
    flex-wrap: wrap;
  }

  .badge {
    background: #eef3fb;
    border: 1px solid #d6dfed;
    color: #334a68;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 999px;
    padding: 0.2rem 0.5rem;
    white-space: nowrap;
  }

  .autosave-badge {
    font-size: 0.78rem;
    color: #5c6c80;
    white-space: nowrap;
    max-width: 18ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .save-btn {
    border-radius: 8px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    color: #223349;
    padding: 0.25rem 0.55rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    min-height: 30px;
  }

  .save-btn:hover {
    background: #edf3fd;
  }

  .settings-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid #d9e1ec;
    background: #f4f7fc;
    color: #5c6c80;
    text-decoration: none;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .settings-link:hover {
    color: #0a63e0;
    border-color: #0a63e0;
    background: #edf3fd;
  }

  .settings-icon {
    display: block;
  }

  /* -- Screen-reader only utility -- */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* -- Layout -- */
  .layout-grid {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .sheet-panel {
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 18px;
    box-shadow: var(--shadow);
    padding: 0.9rem;
    display: grid;
    gap: 0.5rem;
    min-width: 0;
  }

  .sheet-scroll {
    overflow: auto;
    max-height: min(78vh, 58rem);
    border: 1px solid #dbe3ef;
    border-radius: 14px;
    background: white;
  }

  .sheet-table {
    border-collapse: separate;
    border-spacing: 0;
    width: max-content;
    min-width: 100%;
    table-layout: fixed;
    --row1-height: 44px;
    --cell-height: 48px;
    --cell-font: 0.875rem;
    --header-font: 0.95rem;
    --date-font: 0.875rem;
    --cell-padding: 0.2rem 0.35rem;
    --location-padding: 0.45rem 0.6rem;
  }

  .sheet-table th,
  .sheet-table td {
    border-right: 1px solid #e2e8f1;
    border-bottom: 1px solid #e2e8f1;
    padding: 0;
    vertical-align: middle;
  }

  .sheet-table tr > :first-child {
    border-left: 1px solid #e2e8f1;
  }

  .sheet-table thead tr:first-child > * {
    border-top: 1px solid #e2e8f1;
  }

  .first-col {
    width: 220px;
  }

  .date-col {
    width: 128px;
  }

  .sticky-row1 {
    position: sticky;
    top: 0;
    z-index: 8;
    background: #eef3fb;
    height: var(--row1-height);
    min-height: var(--row1-height);
  }

  .sticky-col {
    position: sticky;
    left: 0;
    z-index: 6;
    background: #f9fbff;
  }

  .top-left-cell {
    z-index: 10;
    background: linear-gradient(180deg, #f1f5fd, #ebf1fb);
  }

  .location-header {
    z-index: 9;
    text-align: left;
    padding: 0 0.65rem;
    font-size: var(--header-font);
    font-weight: 700;
    color: #31465f;
    background: #ebf1fb;
  }

  .top-left-content {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 0.1rem;
    height: 100%;
    padding: 0.35rem 0.65rem;
    text-align: left;
  }

  .top-left-content .label {
    font-size: 0.8rem;
    color: #3d5a78;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }

  .top-left-content strong {
    font-size: 0.9rem;
    color: #1b304a;
  }

  .date-header {
    text-align: center;
    font-size: var(--date-font);
    font-weight: 700;
    color: #2d4055;
    white-space: nowrap;
    background: #edf3fb;
  }

  .date-header.today {
    background: rgba(10, 99, 224, 0.1);
    color: #0a63e0;
  }

  .location-cell {
    background: #fcfdff;
    text-align: left;
    padding: var(--location-padding);
    font-size: var(--header-font);
    font-weight: 600;
    color: #27384f;
    z-index: 5;
  }

  .grid-cell {
    height: var(--cell-height);
    min-height: var(--cell-height);
    padding: var(--cell-padding);
    font-size: var(--cell-font);
    color: #1b2940;
    background: #ffffff;
    cursor: pointer;
    user-select: none;
    position: relative;
  }

  .grid-cell:hover {
    background: #f0f6ff;
  }

  .grid-cell.today {
    background: rgba(10, 99, 224, 0.04);
  }

  .grid-cell.today:hover {
    background: rgba(10, 99, 224, 0.09);
  }

  .grid-cell.empty .empty-hint {
    display: none;
    color: #a0b0c4;
    font-size: 1.1rem;
    font-weight: 300;
    position: absolute;
    inset: 0;
    place-content: center;
    place-items: center;
  }

  .grid-cell.empty:hover .empty-hint {
    display: grid;
  }

  .grid-cell.occupied {
    font-weight: 600;
  }

  .reservation-label {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  .grid-cell.occupied:hover {
    filter: brightness(0.97);
  }

  /* Status legend */
  .status-legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
    font-size: 0.85rem;
    color: #334a68;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Toast notifications */
  .toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    background: #1b304a;
    color: white;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(15, 28, 47, 0.2);
    z-index: 200;
    animation: toast-in 0.25s ease-out;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 1100px) {
    .layout-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .toolbar {
      gap: 0.4rem;
      padding: 0.35rem 0.5rem;
    }

    .autosave-badge {
      display: none;
    }
  }
</style>
