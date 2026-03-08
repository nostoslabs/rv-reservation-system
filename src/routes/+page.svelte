<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ParkingLocationsPanel from '$lib/components/ParkingLocationsPanel.svelte';
  import ReservationModal from '$lib/components/ReservationModal.svelte';
  import {
    addDays,
    diffDays,
    formatReservationDetail,
    formatScheduleHeader,
    formatTimestamp,
    getTodayIsoLocal
  } from '$lib/date';
  import { buildCellId, buildOccupancyMap } from '$lib/reservations';
  import {
    STATUS_BACKGROUND_COLORS,
    STATUS_COLORS,
    STATUS_LABELS
  } from '$lib/domain/reservations/status';
  import { siteSettingsStore } from '$lib/site-settings';
  import { rvReservationStore } from '$lib/state';
  import { RESERVATION_STATUSES, type Reservation, type ReservationFormValues, type ReservationStatus } from '$lib/types';

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
      return `Saved just now (${formatTimestamp(lastSavedAt)})`;
    }
    if (ageMinutes === 1) {
      return `Saved 1 minute ago (${formatTimestamp(lastSavedAt)})`;
    }
    if (ageMinutes < 60) {
      return `Saved ${ageMinutes} minutes ago (${formatTimestamp(lastSavedAt)})`;
    }
    const ageHours = Math.floor(ageMinutes / 60);
    return `Saved ${ageHours}h ago (${formatTimestamp(lastSavedAt)})`;
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
    locationPanelError = result.errors?.[0] ?? 'Unable to update sites.';
  }

  function handleAddLocation(event: CustomEvent<{ name: string }>): void {
    applyLocationMutation(rvReservationStore.addParkingLocation(event.detail.name), 'Site added');
  }

  function handleRenameLocation(event: CustomEvent<{ oldName: string; newName: string }>): void {
    applyLocationMutation(
      rvReservationStore.renameParkingLocation(event.detail.oldName, event.detail.newName),
      'Site renamed'
    );
  }

  function handleDeleteLocation(event: CustomEvent<{ name: string }>): void {
    applyLocationMutation(rvReservationStore.deleteParkingLocation(event.detail.name), 'Site deleted');
  }

  function getReservationCellTitle(location: string, dateIso: string, reservation?: Reservation): string {
    if (!reservation) {
      return `Click to add reservation at ${location} on ${formatScheduleHeader(dateIso)}`;
    }

    const lines = [
      `${reservation.name} (${formatReservationDetail(reservation.startDate)} \u2192 ${formatReservationDetail(reservation.endDate)})`,
      `Status: ${STATUS_LABELS[reservation.status]}`,
      `Site: ${reservation.parkingLocation}`
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
    content="RV reservation schedule with localStorage persistence."
  />
</svelte:head>

<div class="page-shell">
  <header class="hero">
    <div>
      <h1>{$siteSettingsStore.siteName}</h1>
      <p class="lede">
        Click any cell in the calendar to add or edit a reservation.
      </p>
    </div>
    <div class="status-card" aria-live="polite">
      <div class="status-title">Autosave</div>
      <div class="status-value">{autosaveStatus}</div>
      <button type="button" on:click={saveNow}>Save Now</button>
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

    <section class="sheet-panel" aria-labelledby="schedule-title">
      <div class="sheet-header">
        <div>
          <h2 id="schedule-title">Schedule</h2>
          <p>Rows = sites, columns = dates. Sticky top rows + sticky first column.</p>
        </div>
        <div class="sheet-stats">
          <span>{ $rvReservationStore.reservations.length } reservations</span>
          <span>{ $rvReservationStore.parkingLocations.length } sites</span>
        </div>
      </div>

      <nav class="grid-nav" aria-label="Grid navigation">
        <button type="button" on:click={() => scrollWeek(-1)}>&#8592; Previous Week</button>
        <button type="button" class="primary" on:click={alignToToday}>Today</button>
        <button type="button" on:click={() => scrollWeek(1)}>Next Week &#8594;</button>
      </nav>

      <div class="status-legend" aria-label="Status legend">
        {#each RESERVATION_STATUSES as statusKey}
          <span class="legend-item">
            <span
              class="legend-swatch"
              style="background: {STATUS_BACKGROUND_COLORS[statusKey]}; border-left: 3px solid {STATUS_COLORS[statusKey]};"
              aria-hidden="true"
            ></span>
            {STATUS_LABELS[statusKey]}
          </span>
        {/each}
      </div>

      <div class="sheet-scroll" bind:this={gridScroller}>
        <table class="sheet-table" aria-label="RV reservation schedule">
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
                  <strong>{formatReservationDetail(todayIso)}</strong>
                </div>
              </th>
              {#each dateColumns as dateIso}
                <th
                  class="sticky-row1 date-header"
                  class:today={dateIso === todayIso}
                  scope="col"
                  data-date={dateIso}
                >
                  {formatScheduleHeader(dateIso)}
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
                    style={reservation ? `background: ${STATUS_BACKGROUND_COLORS[reservation.status]}; border-left: 3px solid ${STATUS_COLORS[reservation.status]};` : ''}
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
    padding: 1rem;
    display: grid;
    gap: 1rem;
  }

  .hero {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 18px;
    box-shadow: var(--shadow);
    padding: 1rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: start;
    backdrop-filter: blur(6px);
  }

  h1 {
    margin: 0.2rem 0 0;
    font-size: clamp(1.15rem, 2vw + 0.7rem, 1.65rem);
  }

  .lede {
    margin: 0.4rem 0 0;
    color: #455566;
    max-width: 60ch;
  }

  .status-card {
    background: linear-gradient(180deg, #fdfefe, #f6f9fd);
    border: 1px solid #d9e1ec;
    border-radius: 14px;
    padding: 0.75rem;
    display: grid;
    gap: 0.4rem;
    min-width: 18rem;
  }

  .status-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #3d5a78;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-value {
    font-size: 0.88rem;
    color: #1c2e45;
    line-height: 1.3;
    min-height: 2.4em;
  }

  .status-card button {
    justify-self: start;
    border-radius: 10px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    min-height: 44px;
  }

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
    gap: 0.75rem;
    min-width: 0;
  }

  .sheet-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
  }

  .sheet-header h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .sheet-header p {
    margin: 0.2rem 0 0;
    color: #455566;
    font-size: 0.95rem;
  }

  .sheet-stats {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .sheet-stats span {
    background: #eef3fb;
    border: 1px solid #d6dfed;
    color: #334a68;
    font-size: 0.875rem;
    border-radius: 999px;
    padding: 0.25rem 0.55rem;
  }

  /* Grid navigation bar */
  .grid-nav {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
  }

  .grid-nav button {
    border-radius: 10px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    color: #223349;
    padding: 0.6rem 1rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    min-height: 44px;
  }

  .grid-nav button:hover {
    background: #edf3fd;
  }

  .grid-nav button.primary {
    background: #0a63e0;
    border-color: #0a63e0;
    color: white;
  }

  .grid-nav button.primary:hover {
    background: #0757c8;
  }

  /* Status legend */
  .status-legend {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: #334a68;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .legend-swatch {
    display: inline-block;
    width: 24px;
    height: 16px;
    border-radius: 3px;
  }

  .sheet-scroll {
    overflow: auto;
    max-height: min(70vh, 52rem);
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
    font-size: 0.95rem;
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
    font-size: 0.875rem;
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
    padding: 0.45rem 0.6rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #27384f;
    z-index: 5;
  }

  .grid-cell {
    height: 48px;
    min-height: 48px;
    padding: 0.2rem 0.35rem;
    font-size: 0.875rem;
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

    .hero {
      grid-template-columns: 1fr;
    }

    .status-card {
      min-width: 0;
    }

    .sheet-header {
      flex-direction: column;
      align-items: start;
    }

    .sheet-stats {
      justify-content: flex-start;
    }
  }
</style>
