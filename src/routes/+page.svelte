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
  import { computeDailySummary } from '$lib/domain/reservations/daily-summary';
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
  let modalTriggerElement: HTMLElement | null = null;
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
  $: dailySummary = computeDailySummary(
    $rvReservationStore.reservations,
    $rvReservationStore.parkingLocations,
    todayIso
  );

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
    // The today column's left edge in the table is at FIRST_COLUMN_WIDTH + todayIndex * DATE_COLUMN_WIDTH.
    // The sticky first column occupies FIRST_COLUMN_WIDTH of the visible viewport, so the
    // visible date area is clientWidth - FIRST_COLUMN_WIDTH wide.
    // To center today in that visible date area, we set scrollLeft so that:
    //   scrollLeft + FIRST_COLUMN_WIDTH + visibleDateWidth/2 = FIRST_COLUMN_WIDTH + todayIndex * DATE_COLUMN_WIDTH + DATE_COLUMN_WIDTH/2
    //   scrollLeft = todayIndex * DATE_COLUMN_WIDTH - (visibleDateWidth - DATE_COLUMN_WIDTH) / 2
    const visibleDateWidth = gridScroller.clientWidth - FIRST_COLUMN_WIDTH;
    const targetScrollLeft = todayIndex * DATE_COLUMN_WIDTH - Math.max(0, (visibleDateWidth - DATE_COLUMN_WIDTH) / 2);
    const maxScrollLeft = Math.max(0, gridScroller.scrollWidth - gridScroller.clientWidth);
    gridScroller.scrollLeft = Math.min(Math.max(0, targetScrollLeft), maxScrollLeft);
  }

  function scrollWeek(direction: number): void {
    gridScroller?.scrollBy({ left: DATE_COLUMN_WIDTH * 7 * direction, behavior: 'smooth' });
  }

  function openModalForCell(parkingLocation: string, dateIso: string, event?: MouseEvent): void {
    modalTriggerElement = (event?.currentTarget as HTMLElement) ?? null;
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

    // Scroll to today immediately, then retry a few times to handle late layout.
    // The grid dimensions may not be final on the first tick, so we retry until the
    // scroller has a nonzero clientWidth (meaning layout is complete) and the scroll
    // position lands correctly.
    void alignToToday();
    const retryDelays = [80, 200, 500];
    const retryTimers = retryDelays.map((delay) =>
      window.setTimeout(() => void alignToToday(), delay)
    );

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
      retryTimers.forEach((t) => window.clearTimeout(t));
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
  <header class="toolbar">
    <h1 class="toolbar-title">{$siteSettingsStore.siteName}</h1>

    <nav class="toolbar-nav" aria-label="Grid navigation">
      <button type="button" on:click={() => scrollWeek(-1)} aria-label="Previous week">&#8592;</button>
      <button type="button" class="primary" on:click={alignToToday}>Today</button>
      <button type="button" on:click={() => scrollWeek(1)} aria-label="Next week">&#8594;</button>
    </nav>

    <div class="toolbar-right">
      <span class="badge">{ $rvReservationStore.reservations.length } res</span>
      <span class="badge">{ $rvReservationStore.parkingLocations.length } sites</span>
      <span class="badge save-badge" aria-live="polite">{autosaveStatus}</span>
      <button type="button" class="save-btn" on:click={saveNow}>Save</button>
    </div>
  </header>

  <div class="daily-summary" aria-label="Daily operations summary">
    <span class="summary-item"><strong>Arriving:</strong> {dailySummary.arrivals}</span>
    <span class="summary-sep" aria-hidden="true">&middot;</span>
    <span class="summary-item"><strong>Departing:</strong> {dailySummary.departures}</span>
    <span class="summary-sep" aria-hidden="true">&middot;</span>
    <span class="summary-item"><strong>Occupied:</strong> {dailySummary.occupied}/{dailySummary.totalSites}</span>
    <span class="summary-sep" aria-hidden="true">&middot;</span>
    <span class="summary-item"><strong>Vacant:</strong> {dailySummary.vacant}</span>
  </div>

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
      <h2 id="schedule-title" class="sr-only">Schedule</h2>

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
                    on:click={(e) => openModalForCell(location, dateIso, e)}
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
  triggerElement={modalTriggerElement}
  on:save={handleModalSave}
  on:cancel={closeModal}
  on:delete={handleModalDelete}
/>

<style>
  .page-shell {
    padding: 0.5rem 1rem;
    display: grid;
    gap: 0.5rem;
  }

  /* -- Compact toolbar ---------------------------------------------------- */
  .toolbar {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 0.4rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    backdrop-filter: blur(6px);
    flex-wrap: wrap;
    min-height: 48px;
  }

  .toolbar-title {
    margin: 0;
    font-size: 1.1rem;
    white-space: nowrap;
  }

  .toolbar-nav {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }

  .daily-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.45rem 1rem;
    background: #f0f5fc;
    border: 1px solid #d6dfed;
    border-radius: 10px;
    font-size: 0.875rem;
    color: #334a68;
  }

  .summary-item strong {
    font-weight: 700;
    color: #1c2e45;
  }

  .summary-sep {
    color: #a0b4cc;
    font-weight: 300;
  }

  .toolbar-nav button {
    border-radius: 8px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    color: #223349;
    padding: 0.3rem 0.65rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    min-height: 36px;
    line-height: 1;
  }

  .toolbar-nav button:hover {
    background: #edf3fd;
  }

  .toolbar-nav button.primary {
    background: #0a63e0;
    border-color: #0a63e0;
    color: white;
    padding: 0.3rem 0.75rem;
  }

  .toolbar-nav button.primary:hover {
    background: #0757c8;
  }

  .toolbar-right {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-left: auto;
    flex-wrap: wrap;
  }

  .badge {
    background: #eef3fb;
    border: 1px solid #d6dfed;
    color: #334a68;
    font-size: 0.8rem;
    border-radius: 999px;
    padding: 0.2rem 0.5rem;
    white-space: nowrap;
  }

  .save-badge {
    color: #3d5a78;
  }

  .save-btn {
    border-radius: 8px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    min-height: 36px;
  }

  .save-btn:hover {
    background: #edf3fd;
  }

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

  .layout-grid {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 0.5rem;
    align-items: start;
  }

  .sheet-panel {
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 14px;
    box-shadow: var(--shadow);
    padding: 0.5rem;
    display: grid;
    gap: 0;
    min-width: 0;
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

  .grid-nav-date {
    font-size: 0.88rem;
    font-weight: 600;
    color: #3d5a78;
    margin-left: 0.25rem;
  }

  .sheet-scroll {
    overflow: auto;
    max-height: min(82vh, 60rem);
    border: 1px solid #dbe3ef;
    border-radius: 10px;
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
    background: rgba(10, 99, 224, 0.12);
    color: #0a63e0;
    box-shadow: inset 0 -3px 0 0 #0a63e0;
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
    background: rgba(10, 99, 224, 0.05);
    border-left: 1px solid rgba(10, 99, 224, 0.18);
    border-right: 1px solid rgba(10, 99, 224, 0.18);
  }

  .grid-cell.today:hover {
    background: rgba(10, 99, 224, 0.1);
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

    .toolbar {
      gap: 0.5rem;
    }

    .save-badge {
      display: none;
    }
  }
</style>
