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
  import { siteSettingsStore } from '$lib/site-settings';
  import { rvReservationStore } from '$lib/state';
  import type { Reservation, ReservationFormValues } from '$lib/types';

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
    color: 'blue'
  };

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
        color: reservation.color
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
        color: 'blue'
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
  }

  function handleModalDelete(event: CustomEvent<{ index: number }>): void {
    const result = rvReservationStore.deleteReservation(event.detail.index);
    if (!result.ok) {
      modalErrors = result.errors;
      return;
    }

    closeModal();
  }

  function applyLocationMutation(result: { ok: boolean; errors?: string[] }): void {
    if (result.ok) {
      locationPanelError = '';
      return;
    }
    locationPanelError = result.errors?.[0] ?? 'Unable to update parking locations.';
  }

  function handleAddLocation(event: CustomEvent<{ name: string }>): void {
    applyLocationMutation(rvReservationStore.addParkingLocation(event.detail.name));
  }

  function handleRenameLocation(event: CustomEvent<{ oldName: string; newName: string }>): void {
    applyLocationMutation(
      rvReservationStore.renameParkingLocation(event.detail.oldName, event.detail.newName)
    );
  }

  function handleDeleteLocation(event: CustomEvent<{ name: string }>): void {
    applyLocationMutation(rvReservationStore.deleteParkingLocation(event.detail.name));
  }

  function isOccupiedCell(location: string, dateIso: string): Reservation | undefined {
    return occupancyMap.get(buildCellId(location, dateIso));
  }

  function getReservationCellTitle(location: string, dateIso: string, reservation?: Reservation): string {
    if (!reservation) {
      return `Double-click to add reservation at ${location} on ${dateIso}`;
    }

    const lines = [
      `${reservation.name} (${reservation.startDate} \u2192 ${reservation.endDate})`,
      `Location: ${reservation.parkingLocation}`
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
  <header class="hero">
    <div>
      <p class="eyebrow">Demo App</p>
      <h1>{$siteSettingsStore.siteName}</h1>
      <p class="lede">
        Double-click any calendar cell to add or edit a reservation. Dates are stored locally in your browser.
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

    <section class="sheet-panel" aria-labelledby="working-sheet-title">
      <div class="sheet-header">
        <div>
          <h2 id="working-sheet-title">Working Sheet</h2>
          <p>Rows = parking locations, columns = dates. Sticky top rows + sticky first column.</p>
        </div>
        <div class="sheet-stats">
          <span>{ $rvReservationStore.reservations.length } reservations</span>
          <span>{ $rvReservationStore.parkingLocations.length } locations</span>
        </div>
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
            <tr class="toolbar-row">
              <th class="sticky-row1 sticky-col top-left-cell" scope="col">
                <div class="top-left-content">
                  <span class="label">Current Date</span>
                  <strong>{formatDisplayDate(todayIso)}</strong>
                </div>
              </th>
              {#each dateColumns as _date, index}
                <th class="sticky-row1 toolbar-cell" scope="col">
                  {#if index === 0}
                    <button type="button" class="grid-button" on:click={saveNow}>SAVE</button>
                  {:else if index === 1}
                    <button type="button" class="grid-button" on:click={() => gridScroller?.scrollBy({ left: DATE_COLUMN_WIDTH * 7, behavior: 'smooth' })}>
                      +7 DAYS
                    </button>
                  {:else if index === 2}
                    <button type="button" class="grid-button primary" on:click={alignToToday}>TODAY</button>
                  {:else}
                    <span class="toolbar-placeholder" aria-hidden="true"></span>
                  {/if}
                </th>
              {/each}
            </tr>

            <tr class="calendar-row">
              <th class="sticky-row2 sticky-col location-header" scope="col">Parking Location</th>
              {#each dateColumns as dateIso}
                <th class="sticky-row2 date-header" scope="col" data-date={dateIso}>
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
                  {@const reservation = isOccupiedCell(location, dateIso)}
                  <td
                    class={`grid-cell ${reservation ? `occupied color-${reservation.color}` : ''}`}
                    on:dblclick={() => openModalForCell(location, dateIso)}
                    title={getReservationCellTitle(location, dateIso, reservation)}
                  >
                    {#if reservation}
                      <span class="reservation-label">{reservation.name}</span>
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

  .eyebrow {
    margin: 0;
    color: #406286;
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.2rem 0 0;
    font-size: clamp(1.15rem, 2vw + 0.7rem, 1.65rem);
  }

  .lede {
    margin: 0.4rem 0 0;
    color: #5c6b7e;
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
    font-size: 0.8rem;
    font-weight: 700;
    color: #45607f;
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
    padding: 0.5rem 0.7rem;
    cursor: pointer;
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
    color: #5d6c80;
    font-size: 0.85rem;
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
    font-size: 0.8rem;
    border-radius: 999px;
    padding: 0.25rem 0.55rem;
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
    --row1-height: 46px;
    --row2-height: 40px;
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
    background: #f7fafe;
    height: var(--row1-height);
    min-height: var(--row1-height);
  }

  .sticky-row2 {
    position: sticky;
    top: var(--row1-height);
    z-index: 7;
    background: #eef3fb;
    height: var(--row2-height);
    min-height: var(--row2-height);
  }

  .sticky-col {
    position: sticky;
    left: 0;
    z-index: 6;
    background: #f9fbff;
  }

  .top-left-cell {
    z-index: 10;
    background: linear-gradient(180deg, #f8fbff, #f1f5fd);
  }

  .location-header {
    z-index: 9;
    text-align: left;
    padding: 0 0.65rem;
    font-size: 0.85rem;
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
    font-size: 0.7rem;
    color: #54708f;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }

  .top-left-content strong {
    font-size: 0.9rem;
    color: #1b304a;
  }

  .toolbar-cell {
    background: #f7fafe;
    text-align: center;
  }

  .toolbar-placeholder {
    display: block;
    height: 100%;
  }

  .grid-button {
    height: 100%;
    width: 100%;
    border: 0;
    background: transparent;
    color: #324a67;
    font-weight: 700;
    font-size: 0.78rem;
    letter-spacing: 0.03em;
    cursor: pointer;
  }

  .grid-button:hover {
    background: #edf3fd;
  }

  .grid-button.primary {
    background: #0a63e0;
    color: white;
  }

  .grid-button.primary:hover {
    background: #0757c8;
  }

  .date-header {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #3a536f;
    white-space: nowrap;
    background: #edf3fb;
  }

  .location-cell {
    background: #fcfdff;
    text-align: left;
    padding: 0.45rem 0.6rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #27384f;
    z-index: 5;
  }

  .grid-cell {
    height: 44px;
    min-height: 44px;
    padding: 0.2rem 0.35rem;
    font-size: 0.75rem;
    color: #1b2940;
    background: #ffffff;
    cursor: cell;
    user-select: none;
  }

  .grid-cell:hover {
    background: #f8fbff;
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

  .color-red {
    background: #ffd9d9;
  }

  .color-green {
    background: #ddf7dd;
  }

  .color-blue {
    background: #d9ebff;
  }

  .color-yellow {
    background: #fff5c6;
  }

  .color-pink {
    background: #ffe0ef;
  }

  .color-orange {
    background: #ffe5cd;
  }

  .color-purple {
    background: #eadfff;
  }

  .grid-cell.occupied:hover {
    filter: brightness(0.98);
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
