<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  import { filterReservations } from '$lib/domain/reservations/search';
  import { buildCellId, buildOccupancyMap, rangesOverlap } from '$lib/reservations';
  import { enumerateDates } from '$lib/date';
  import {
    STATUS_BACKGROUND_COLORS,
    STATUS_COLORS,
    STATUS_ICONS,
    STATUS_LABELS,
    STATUS_PATTERNS,
    STATUS_PATTERN_SIZES
  } from '$lib/domain/reservations/status';
  import { siteSettingsStore } from '$lib/site-settings';
  import { rvReservationStore } from '$lib/state';
  import { customerStore } from '$lib/customer-state';
  import { RESERVATION_STATUSES, type Reservation, type ReservationFormValues, type ReservationStatus } from '$lib/types';
  import {
    deleteReservationWithUndo,
    saveReservationWithUndo,
    moveReservationWithUndo
  } from '$lib/app/undoable-actions';
  import { canUndo, lastLabel, undo } from '$lib/app/undo';

  const DAYS_BEFORE_TODAY = 45;
  const TOTAL_DATE_COLUMNS = 540;

  const todayIso = getTodayIsoLocal();
  const gridStartDate = addDays(todayIso, -DAYS_BEFORE_TODAY);
  const dateColumns = Array.from({ length: TOTAL_DATE_COLUMNS }, (_, index) => addDays(gridStartDate, index));

  let gridScroller: HTMLDivElement | null = null;
  let nowMs = Date.now();
  let occupancyMap: Map<string, Reservation> = new Map();
  let reservationCountsByLocation: Record<string, number> = {};
  let saveStatus = 'Changes save automatically';

  // Column virtualization — only render visible date columns + buffer
  const COLUMN_BUFFER = 10;
  let visStartCol = Math.max(0, DAYS_BEFORE_TODAY - 15);
  let visEndCol = Math.min(TOTAL_DATE_COLUMNS, DAYS_BEFORE_TODAY + 25);
  let rafPending = false;

  function updateVisibleColumns(): void {
    if (!gridScroller) return;
    const scrollLeft = gridScroller.scrollLeft;
    const viewportWidth = gridScroller.clientWidth;
    const colWidth = DATE_COLUMN_WIDTH;
    const firstVisible = Math.floor(scrollLeft / colWidth);
    const colsFit = Math.ceil(viewportWidth / colWidth) + 1;
    const newStart = Math.max(0, firstVisible - COLUMN_BUFFER);
    const newEnd = Math.min(TOTAL_DATE_COLUMNS, firstVisible + colsFit + COLUMN_BUFFER);
    if (newStart !== visStartCol || newEnd !== visEndCol) {
      visStartCol = newStart;
      visEndCol = newEnd;
    }
  }

  function handleGridScroll(): void {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      updateVisibleColumns();
    });
  }

  $: visibleDateColumns = dateColumns.slice(visStartCol, visEndCol);
  $: leftSpacerWidth = visStartCol * DATE_COLUMN_WIDTH;
  $: rightSpacerWidth = (TOTAL_DATE_COLUMNS - visEndCol) * DATE_COLUMN_WIDTH;

  let modalOpen = false;
  let modalMode: 'create' | 'edit' = 'create';
  let modalErrors: string[] = [];
  let modalTriggerElement: HTMLElement | null = null;
  let modalDraft: ReservationFormValues = {
    name: '',
    rvType: '',
    phoneNumber: '',
    notes: '',
    startDate: todayIso,
    endDate: addDays(todayIso, 1),
    parkingLocation: '',
    color: 'blue',
    status: 'reserved'
  };

  // Search state
  let searchQuery = '';
  let searchOpen = false;
  let searchInputEl: HTMLInputElement | null = null;
  let searchContainerEl: HTMLDivElement | null = null;
  let selectedSearchIndex = -1;

  $: searchResults = filterReservations($rvReservationStore.reservations, searchQuery);
  $: if (searchQuery.trim() !== '') {
    searchOpen = true;
    selectedSearchIndex = -1;
  } else {
    searchOpen = false;
  }

  function handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      searchOpen = false;
      searchQuery = '';
      searchInputEl?.blur();
      return;
    }
    if (!searchOpen || searchResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedSearchIndex = Math.min(selectedSearchIndex + 1, searchResults.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedSearchIndex = Math.max(selectedSearchIndex - 1, 0);
    } else if (event.key === 'Enter' && selectedSearchIndex >= 0) {
      event.preventDefault();
      openReservationFromSearch(searchResults[selectedSearchIndex].reservation);
    }
  }

  function openReservationFromSearch(reservation: Reservation): void {
    searchOpen = false;
    searchQuery = '';

    modalMode = 'edit';
    modalDraft = {
      index: reservation.index,
      name: reservation.name,
      rvType: reservation.rvType,
      phoneNumber: reservation.phoneNumber,
      notes: reservation.notes,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      parkingLocation: reservation.parkingLocation,
      color: reservation.color,
      status: reservation.status,
      customerId: reservation.customerId
    };
    modalErrors = [];
    modalOpen = true;
  }

  function handleSearchClickOutside(event: MouseEvent): void {
    if (searchContainerEl && !searchContainerEl.contains(event.target as Node)) {
      searchOpen = false;
    }
  }

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

  // Drag state
  const DRAG_THRESHOLD = 5;
  let dragState: {
    reservation: Reservation;
    originX: number;
    originY: number;
    started: boolean;
    currentDaysDelta: number;
    currentSite: string;
  } | null = null;
  let dragPreviewCells: Set<string> = new Set();
  let dragHasOverlap = false;
  let dragEndedAt = 0;

  function handleCellPointerDown(location: string, dateIso: string, event: PointerEvent): void {
    const reservation = occupancyMap.get(buildCellId(location, dateIso));
    if (!reservation) return;

    dragState = {
      reservation,
      originX: event.clientX,
      originY: event.clientY,
      started: false,
      currentDaysDelta: 0,
      currentSite: reservation.parkingLocation
    };
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragState) return;

    const dx = event.clientX - dragState.originX;
    const dy = event.clientY - dragState.originY;

    if (!dragState.started) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragState.started = true;
      // Capture pointer to track movement outside the grid
      (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
    }

    // Calculate day delta from horizontal movement
    const daysDelta = Math.round(dx / DATE_COLUMN_WIDTH);

    // Calculate site from vertical movement
    const locations = $rvReservationStore.parkingLocations;
    const origSiteIndex = locations.indexOf(dragState.reservation.parkingLocation);
    // Each row is approximately cell-height. Use the grid cell height.
    const cellHeight = compactView ? 28 : 48;
    const rowDelta = Math.round(dy / cellHeight);
    const newSiteIndex = Math.max(0, Math.min(locations.length - 1, origSiteIndex + rowDelta));
    const targetSite = locations[newSiteIndex];

    dragState.currentDaysDelta = daysDelta;
    dragState.currentSite = targetSite;

    // Compute preview cells
    const res = dragState.reservation;
    const nights = diffDays(res.startDate, res.endDate);
    const newStart = addDays(res.startDate, daysDelta);
    const newEnd = addDays(newStart, nights);
    const previewDates = enumerateDates(newStart, newEnd);
    dragPreviewCells = new Set(previewDates.map((d) => buildCellId(targetSite, d)));

    // Check for overlaps
    dragHasOverlap = false;
    for (const other of $rvReservationStore.reservations) {
      if (other.index === res.index) continue;
      if (other.parkingLocation !== targetSite) continue;
      if (rangesOverlap(newStart, newEnd, other.startDate, other.endDate)) {
        dragHasOverlap = true;
        break;
      }
    }
  }

  async function handlePointerUp(event: PointerEvent): Promise<void> {
    if (!dragState) return;

    const state = dragState;
    const wasStarted = state.started;
    dragState = null;
    dragPreviewCells = new Set();
    dragHasOverlap = false;

    // Release pointer capture
    (event.currentTarget as HTMLElement)?.releasePointerCapture?.(event.pointerId);

    if (!wasStarted) return; // Was a click, not a drag — let the click handler deal with it
    dragEndedAt = Date.now();

    const { reservation, currentDaysDelta, currentSite } = state;
    if (currentDaysDelta === 0 && currentSite === reservation.parkingLocation) return;

    const newSite = currentSite !== reservation.parkingLocation ? currentSite : undefined;
    const result = await moveReservationWithUndo(reservation.index, currentDaysDelta, newSite);
    if (!result.ok) {
      showToast(result.errors?.[0] ?? 'Cannot move reservation');
    } else {
      showToast('Reservation moved');
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && dragState?.started) {
      dragState = null;
      dragPreviewCells = new Set();
      dragHasOverlap = false;
      dragEndedAt = Date.now();
    }
  }

  $: compactView = $siteSettingsStore.compactView ?? false;
  $: FIRST_COLUMN_WIDTH = compactView ? 140 : 220;
  $: DATE_COLUMN_WIDTH = compactView ? 90 : 128;

  $: occupancyMap = buildOccupancyMap($rvReservationStore.reservations);
  $: reservationCountsByLocation = Object.fromEntries(
    $rvReservationStore.parkingLocations.map((location) => [
      location,
      $rvReservationStore.reservations.filter((reservation) => reservation.parkingLocation === location).length
    ])
  ) as Record<string, number>;
  $: saveStatus = getSaveStatus($rvReservationStore.lastSavedAt, nowMs);
  $: dailySummary = computeDailySummary(
    $rvReservationStore.reservations,
    $rvReservationStore.parkingLocations,
    todayIso
  );

  function getSaveStatus(lastSavedAt: number | null, nowTimestamp: number): string {
    if (!lastSavedAt) return 'Changes save automatically';
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
    updateVisibleColumns();
  }

  function scrollWeek(direction: number): void {
    gridScroller?.scrollBy({ left: DATE_COLUMN_WIDTH * 7 * direction, behavior: 'smooth' });
  }

  function openNewReservationModal(): void {
    const firstLocation = $rvReservationStore.parkingLocations[0] ?? '';
    modalMode = 'create';
    modalDraft = {
      name: '',
      rvType: '',
      phoneNumber: '',
      notes: '',
      startDate: todayIso,
      endDate: addDays(todayIso, 1),
      parkingLocation: firstLocation,
      color: 'blue',
      status: 'reserved'
    };
    modalErrors = [];
    modalOpen = true;
  }

  function openModalForCell(parkingLocation: string, dateIso: string, event?: MouseEvent): void {
    // Don't open modal if we just finished or cancelled a drag
    if (dragState?.started) return;
    if (Date.now() - dragEndedAt < 200) return;
    modalTriggerElement = (event?.currentTarget as HTMLElement) ?? null;
    const reservation = occupancyMap.get(buildCellId(parkingLocation, dateIso));

    if (reservation) {
      modalMode = 'edit';
      modalDraft = {
        index: reservation.index,
        name: reservation.name,
        rvType: reservation.rvType,
        phoneNumber: reservation.phoneNumber,
        notes: reservation.notes,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        parkingLocation: reservation.parkingLocation,
        color: reservation.color,
        status: reservation.status,
        customerId: reservation.customerId
      };
    } else {
      modalMode = 'create';
      modalDraft = {
        name: '',
        rvType: '',
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

  async function handleModalSave(event: CustomEvent<ReservationFormValues>): Promise<void> {
    const result = await saveReservationWithUndo(event.detail);
    if (!result.ok) {
      modalErrors = result.errors;
      return;
    }

    // Auto-create or link customer
    if (!event.detail.customerId && event.detail.name.trim()) {
      await customerStore.findOrCreateFromReservation(event.detail.name, event.detail.phoneNumber);
    }

    closeModal();
    showToast('Reservation saved');
  }

  async function handleModalDelete(event: CustomEvent<{ index: number }>): Promise<void> {
    const result = await deleteReservationWithUndo(event.detail.index);
    if (!result.ok) {
      modalErrors = result.errors;
      return;
    }

    closeModal();
    showToast('Reservation deleted');
  }

  function handleModalBookAgain(event: CustomEvent<ReservationFormValues>): void {
    const { name, rvType, phoneNumber, notes, parkingLocation, color, customerId } = event.detail;
    modalMode = 'create';
    modalDraft = {
      name,
      rvType,
      phoneNumber,
      notes,
      startDate: todayIso,
      endDate: addDays(todayIso, 1),
      parkingLocation,
      color,
      status: 'reserved',
      customerId
    };
    modalErrors = [];
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

  async function handleToolbarUndo(): Promise<void> {
    const result = await undo();
    if (result.ok && result.label) {
      showToast(`Undid: ${result.label}`);
    }
  }

  async function toggleCompactView(): Promise<void> {
    const result = await siteSettingsStore.setCompactView(!compactView);
    if (!result.ok) {
      showToast(result.errors?.[0] ?? 'Unable to save settings');
      return;
    }

    await tick();
    updateVisibleColumns();
    await alignToToday();
  }

  onMount(() => {
    rvReservationStore.hydrate();
    siteSettingsStore.hydrate();
    customerStore.hydrate();

    // Attach scroll listener for column virtualization
    const scroller = gridScroller;
    scroller?.addEventListener('scroll', handleGridScroll, { passive: true });

    // Scroll to today immediately, then retry a few times to handle late layout.
    void alignToToday();
    const retryDelays = [80, 200, 500];
    const retryTimers = retryDelays.map((delay) =>
      window.setTimeout(() => void alignToToday(), delay)
    );

    const displayTicker = window.setInterval(() => {
      nowMs = Date.now();
    }, 60_000);

    document.addEventListener('click', handleSearchClickOutside);

    return () => {
      scroller?.removeEventListener('scroll', handleGridScroll);
      retryTimers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(displayTicker);
      document.removeEventListener('click', handleSearchClickOutside);
      if (toastTimer) clearTimeout(toastTimer);
    };
  });
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<svelte:head>
  <title>{$siteSettingsStore.siteName}</title>
  <meta
    name="description"
    content="RV reservation schedule with automatic local persistence."
  />
</svelte:head>

<div class="page-shell">
  <header class="toolbar">
    <h1 class="toolbar-title">{$siteSettingsStore.siteName}</h1>

    <nav class="toolbar-nav" aria-label="Grid navigation">
      <button type="button" on:click={() => scrollWeek(-1)} aria-label="Previous week">&#8592;</button>
      <button type="button" class="primary" data-testid="today-button" on:click={alignToToday}>Today</button>
      <button type="button" on:click={() => scrollWeek(1)} aria-label="Next week">&#8594;</button>
      <button
        type="button"
        class="compact-toggle-btn"
        class:primary={compactView}
        data-testid="compact-toggle"
        on:click={toggleCompactView}
        aria-pressed={compactView}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="14" height="14">
          <rect x="2" y="4" width="16" height="2" rx="1" />
          <rect x="2" y="9" width="16" height="2" rx="1" />
          <rect x="2" y="14" width="16" height="2" rx="1" />
        </svg>
        {compactView ? 'Normal' : 'Compact'}
      </button>
      {#if $canUndo}
        <button
          type="button"
          class="undo-toolbar-btn"
          on:click={handleToolbarUndo}
          title={$lastLabel ? `Undo: ${$lastLabel}` : 'Undo'}
          data-testid="undo-toolbar-btn"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="14" height="14">
            <path fill-rule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 110 14H8a1 1 0 110-2h3a5 5 0 100-10H5.414l2.293 2.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          Undo
        </button>
      {/if}
    </nav>

    <div class="toolbar-right">
      <div class="search-container" bind:this={searchContainerEl}>
        <div class="search-input-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="16" height="16">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
          <input
            type="search"
            class="search-input"
            placeholder="Search guests..."
            bind:value={searchQuery}
            bind:this={searchInputEl}
            on:keydown={handleSearchKeydown}
            aria-label="Search reservations"
            aria-expanded={searchOpen && searchResults.length > 0}
            aria-controls="search-results-dropdown"
            role="combobox"
            aria-autocomplete="list"
          />
        </div>
        {#if searchOpen && searchResults.length > 0}
          <ul class="search-dropdown" id="search-results-dropdown" role="listbox">
            {#each searchResults.slice(0, 15) as result, i}
              <li
                class="search-result"
                class:selected={i === selectedSearchIndex}
                role="option"
                aria-selected={i === selectedSearchIndex}
                on:click={() => openReservationFromSearch(result.reservation)}
                on:keydown={(e) => { if (e.key === 'Enter') openReservationFromSearch(result.reservation); }}
                on:mouseenter={() => { selectedSearchIndex = i; }}
              >
                <span class="search-result-name">{result.reservation.name}</span>
                <span class="search-result-meta">
                  <span class="search-result-location">{result.reservation.parkingLocation}</span>
                  {#if result.reservation.phoneNumber}
                    <span class="search-result-phone">{result.reservation.phoneNumber}</span>
                  {/if}
                  <span class="search-result-dates">{formatReservationDetail(result.reservation.startDate)} - {formatReservationDetail(result.reservation.endDate)}</span>
                </span>
              </li>
            {/each}
          </ul>
        {:else if searchOpen && searchQuery.trim() !== ''}
          <div class="search-dropdown search-no-results" id="search-results-dropdown">
            No results found
          </div>
        {/if}
      </div>
      <button type="button" class="new-reservation-btn" data-testid="new-reservation-btn" on:click={openNewReservationModal}>+ New Reservation</button>
      <span class="badge">{ $rvReservationStore.reservations.length } res</span>
      <span class="badge">{ $rvReservationStore.parkingLocations.length } sites</span>
      <span class="badge save-badge" aria-live="polite">{saveStatus}</span>
      <a href="/customers" class="settings-link" title="Customers" aria-label="Customers" data-testid="customers-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="20" height="20">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </a>
      <a href="/admin" class="settings-link" title="Settings" aria-label="Settings" data-testid="settings-link">
        <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="20" height="20">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </a>
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
    <section class="sheet-panel" aria-labelledby="schedule-title">
      <h2 id="schedule-title" class="sr-only">Schedule</h2>

      <div class="status-legend" aria-label="Status legend">
        {#each RESERVATION_STATUSES as statusKey}
          <span class="legend-item">
            <span
              class="legend-swatch"
              style="background-color: {STATUS_BACKGROUND_COLORS[statusKey]}; background-image: {STATUS_PATTERNS[statusKey]}; background-size: {STATUS_PATTERN_SIZES[statusKey]}; border-left: 3px solid {STATUS_COLORS[statusKey]};"
              aria-hidden="true"
            ></span>
            <span aria-hidden="true">{STATUS_ICONS[statusKey]}</span> {STATUS_LABELS[statusKey]}
          </span>
        {/each}
      </div>

      {#if $rvReservationStore.reservations.length === 0 && $rvReservationStore.parkingLocations.length > 0}
        <div class="empty-state" data-testid="empty-state">
          <p>No reservations yet. Click <button type="button" class="inline-action" on:click={openNewReservationModal}>+ New Reservation</button> above or click any cell in the calendar to get started.</p>
        </div>
      {/if}

      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="sheet-scroll"
        class:compact={compactView}
        class:dragging={dragState?.started}
        bind:this={gridScroller}
        on:pointermove={handlePointerMove}
        on:pointerup={handlePointerUp}
      >
        <table class="sheet-table" aria-label="RV reservation schedule">
          <colgroup>
            <col class="first-col" />
            {#if leftSpacerWidth > 0}
              <col style="width:{leftSpacerWidth}px" />
            {/if}
            {#each visibleDateColumns as _date}
              <col class="date-col" />
            {/each}
            {#if rightSpacerWidth > 0}
              <col style="width:{rightSpacerWidth}px" />
            {/if}
          </colgroup>

          <thead>
            <tr class="calendar-row">
              <th class="sticky-row1 sticky-col top-left-cell location-header" scope="col">
                <div class="top-left-content">
                  <span class="label">Current Date</span>
                  <strong>{formatReservationDetail(todayIso)}</strong>
                </div>
              </th>
              {#if leftSpacerWidth > 0}
                <th class="sticky-row1 spacer-cell" aria-hidden="true"></th>
              {/if}
              {#each visibleDateColumns as dateIso (dateIso)}
                <th
                  class="sticky-row1 date-header"
                  class:today={dateIso === todayIso}
                  scope="col"
                  data-date={dateIso}
                >
                  {formatScheduleHeader(dateIso)}
                </th>
              {/each}
              {#if rightSpacerWidth > 0}
                <th class="sticky-row1 spacer-cell" aria-hidden="true"></th>
              {/if}
            </tr>
          </thead>

          <tbody>
            {#each $rvReservationStore.parkingLocations as location}
              <tr>
                <th class="sticky-col location-cell" scope="row">{location}</th>
                {#if leftSpacerWidth > 0}
                  <td class="spacer-cell" aria-hidden="true"></td>
                {/if}
                {#each visibleDateColumns as dateIso (dateIso)}
                  {@const cellId = buildCellId(location, dateIso)}
                  {@const reservation = occupancyMap.get(cellId)}
                  {@const isDragSource = dragState?.started && reservation?.index === dragState.reservation.index}
                  {@const isDragPreview = dragPreviewCells.has(cellId)}
                  <td
                    class={`grid-cell ${reservation ? 'occupied' : 'empty'} ${dateIso === todayIso ? 'today' : ''} ${isDragSource ? 'drag-source' : ''} ${isDragPreview ? (dragHasOverlap ? 'drag-preview-error' : 'drag-preview') : ''}`}
                    style={reservation && !isDragSource ? `background-color: ${STATUS_BACKGROUND_COLORS[reservation.status]}; background-image: ${STATUS_PATTERNS[reservation.status]}; background-size: ${STATUS_PATTERN_SIZES[reservation.status]}; border-left: 3px solid ${STATUS_COLORS[reservation.status]};` : ''}
                    on:click={(e) => openModalForCell(location, dateIso, e)}
                    on:pointerdown={(e) => handleCellPointerDown(location, dateIso, e)}
                    title={getReservationCellTitle(location, dateIso, reservation)}
                  >
                    {#if reservation && !isDragSource}
                      <span class="reservation-label"><span class="status-icon" aria-hidden="true">{STATUS_ICONS[reservation.status]}</span>{reservation.name}</span>
                    {:else if isDragPreview}
                      <span class="reservation-label drag-ghost"><span class="status-icon" aria-hidden="true">{STATUS_ICONS[dragState?.reservation.status ?? 'reserved']}</span>{dragState?.reservation.name}</span>
                    {:else if !reservation}
                      <span class="empty-hint" aria-hidden="true">+</span>
                    {/if}
                  </td>
                {/each}
                {#if rightSpacerWidth > 0}
                  <td class="spacer-cell" aria-hidden="true"></td>
                {/if}
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
  customers={$customerStore}
  triggerElement={modalTriggerElement}
  on:save={handleModalSave}
  on:cancel={closeModal}
  on:delete={handleModalDelete}
  on:bookagain={handleModalBookAgain}
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

  .settings-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid #d9e1ec;
    background: #f6f9fd;
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

  .toolbar-nav .compact-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
    font-size: 0.8rem;
  }

  .toolbar-nav .compact-toggle-btn:hover {
    background: #edf3fd;
  }

  .toolbar-nav .compact-toggle-btn.primary {
    background: #0a63e0;
    border-color: #0a63e0;
    color: white;
  }

  .toolbar-nav .compact-toggle-btn.primary:hover {
    background: #0757c8;
  }

  .toolbar-nav .undo-toolbar-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
    font-size: 0.8rem;
    animation: fade-in 0.15s ease-out;
  }

  .toolbar-nav .undo-toolbar-btn:hover {
    background: #edf3fd;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
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

  .new-reservation-btn {
    border-radius: 8px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    color: #223349;
    padding: 0.3rem 0.65rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    min-height: 36px;
    white-space: nowrap;
  }

  .new-reservation-btn:hover {
    background: #edf3fd;
  }

  .save-badge {
    color: #3d5a78;
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
    grid-template-columns: 1fr;
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

  /* Empty state prompt */
  .empty-state {
    background: #f0f6ff;
    border: 1px dashed #b0c4de;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    text-align: center;
    color: #3d5a78;
    font-size: 0.95rem;
  }

  .empty-state p {
    margin: 0;
    line-height: 1.6;
  }

  .inline-action {
    background: none;
    border: none;
    color: #16a34a;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    text-decoration: underline;
    min-height: auto;
  }

  .inline-action:hover {
    color: #15803d;
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
    --cell-height: 48px;
    --cell-font: 0.875rem;
    --header-font: 0.95rem;
    --date-font: 0.875rem;
    --cell-padding: 0.2rem 0.35rem;
    --location-padding: 0.45rem 0.6rem;
  }

  .compact .sheet-table {
    --row1-height: 32px;
    --cell-height: 28px;
    --cell-font: 0.75rem;
    --header-font: 0.8rem;
    --date-font: 0.75rem;
    --cell-padding: 0.1rem 0.2rem;
    --location-padding: 0.2rem 0.4rem;
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

  .compact .first-col {
    width: 140px;
  }

  .date-col {
    width: 128px;
  }

  .compact .date-col {
    width: 90px;
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
    background: rgba(10, 99, 224, 0.12);
    color: #0a63e0;
    box-shadow: inset 0 -3px 0 0 #0a63e0;
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

  .spacer-cell {
    padding: 0;
    border: none;
    background: #ffffff;
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
    background: rgba(10, 99, 224, 0.05);
    border-left: 1px solid rgba(10, 99, 224, 0.18);
    border-right: 1px solid rgba(10, 99, 224, 0.18);
  }

  .grid-cell.today:hover {
    background: rgba(10, 99, 224, 0.1);
  }

  .grid-cell.empty .empty-hint {
    display: grid;
    color: #d0d8e4;
    font-size: 1.1rem;
    font-weight: 300;
    position: absolute;
    inset: 0;
    place-content: center;
    place-items: center;
    transition: color 0.15s;
  }

  .grid-cell.empty:hover .empty-hint {
    color: #8899b0;
  }

  .grid-cell.occupied {
    font-weight: 600;
  }

  .status-icon {
    margin-right: 2px;
    font-size: 0.75em;
  }

  .reservation-label {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  .compact .reservation-label {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .grid-cell.occupied {
    cursor: grab;
  }

  .dragging .grid-cell.occupied {
    cursor: grabbing;
  }

  .grid-cell.occupied:hover {
    filter: brightness(0.97);
  }

  .grid-cell.drag-source {
    opacity: 0.3;
    background: #e8ecf2 !important;
    border-left-color: #c8d1de !important;
  }

  .grid-cell.drag-preview {
    background: rgba(10, 99, 224, 0.15) !important;
    border-left: 3px solid #0a63e0 !important;
  }

  .grid-cell.drag-preview-error {
    background: rgba(212, 42, 42, 0.12) !important;
    border-left: 3px solid #d42a2a !important;
  }

  .drag-ghost {
    opacity: 0.7;
  }

  /* Search */
  .search-container {
    position: relative;
    align-self: center;
    min-width: 14rem;
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 0.65rem;
    color: #7a8da4;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    padding: 0.6rem 0.75rem 0.6rem 2rem;
    font-size: 0.9rem;
    color: #1c2e45;
    min-height: 44px;
  }

  .search-input::placeholder {
    color: #8a9bb2;
  }

  .search-input:focus {
    background: white;
    border-color: #0a63e0;
  }

  .search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #d6deea;
    border-radius: 12px;
    box-shadow: 0 12px 36px rgba(10, 24, 47, 0.14);
    z-index: 50;
    max-height: 24rem;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 0.35rem;
  }

  .search-no-results {
    padding: 0.85rem 0.75rem;
    color: #6b7d93;
    font-size: 0.9rem;
    text-align: center;
  }

  .search-result {
    display: grid;
    gap: 0.15rem;
    padding: 0.55rem 0.65rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .search-result:hover,
  .search-result.selected {
    background: #eef3fb;
  }

  .search-result-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1b304a;
  }

  .search-result-meta {
    display: flex;
    gap: 0.6rem;
    font-size: 0.82rem;
    color: #5a6f87;
  }

  .search-result-location {
    font-weight: 600;
  }

  .search-result-phone {
    color: #7a8da3;
    font-style: italic;
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
    .toolbar {
      gap: 0.5rem;
    }

    .save-badge {
      display: none;
    }

    .search-container {
      min-width: 0;
    }
  }
</style>
