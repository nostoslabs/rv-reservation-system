<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getTodayIsoLocal } from '$lib/date';

  export let startDate = '';
  export let endDate = '';

  const dispatch = createEventDispatcher<{
    change: { startDate: string; endDate: string };
  }>();

  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let selectionPhase: 'start' | 'end' = startDate ? 'end' : 'start';
  let hoverDate = '';

  // Initialize view to the start date's month, or today
  let viewYear: number;
  let viewMonth: number; // 0-indexed
  $: {
    const ref = startDate || getTodayIsoLocal();
    const [y, m] = ref.split('-').map(Number);
    if (!viewYear) { viewYear = y; viewMonth = m - 1; }
  }

  // Reset view month when modal reopens with a new start date
  let lastStartProp = startDate;
  $: if (startDate !== lastStartProp) {
    lastStartProp = startDate;
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      viewYear = y;
      viewMonth = m - 1;
    }
    selectionPhase = startDate ? 'end' : 'start';
  }

  function toIso(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function prevMonth(): void {
    if (viewMonth === 0) { viewMonth = 11; viewYear--; }
    else { viewMonth--; }
  }

  function nextMonth(): void {
    if (viewMonth === 11) { viewMonth = 0; viewYear++; }
    else { viewMonth++; }
  }

  function handleDayClick(iso: string): void {
    if (selectionPhase === 'start') {
      dispatch('change', { startDate: iso, endDate: '' });
      selectionPhase = 'end';
    } else {
      if (iso <= startDate) {
        // Clicked before start — restart selection
        dispatch('change', { startDate: iso, endDate: '' });
        selectionPhase = 'end';
      } else {
        dispatch('change', { startDate, endDate: iso });
        selectionPhase = 'start';
      }
    }
    hoverDate = '';
  }

  function handleDayHover(iso: string): void {
    if (selectionPhase === 'end' && startDate) {
      hoverDate = iso;
    }
  }

  function handleMouseLeave(): void {
    hoverDate = '';
  }

  // Build the grid for the current view month
  $: daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  $: firstDow = new Date(viewYear, viewMonth, 1).getDay();

  // Determine the effective end for range highlighting (use hover if selecting)
  $: effectiveEnd = (selectionPhase === 'end' && hoverDate && hoverDate > startDate)
    ? hoverDate
    : endDate;

  $: today = getTodayIsoLocal();

  function buildDayClasses(
    numDays: number, vYear: number, vMonth: number,
    start: string, end: string, effEnd: string,
    phase: string, hover: string, todayIso: string
  ): Record<string, string> {
    const map: Record<string, string> = {};
    for (let i = 0; i < numDays; i++) {
      const day = i + 1;
      const iso = toIso(vYear, vMonth, day);
      const classes: string[] = ['day'];
      if (iso === todayIso) classes.push('today');
      if (iso === start) classes.push('range-start');
      if (iso === effEnd) classes.push('range-end');
      if (start && effEnd && iso > start && iso < effEnd) classes.push('in-range');
      if (phase === 'end' && hover && hover > start && iso > start && iso <= hover && !end) {
        classes.push('hover-range');
      }
      map[iso] = classes.join(' ');
    }
    return map;
  }

  // All reactive deps are explicit arguments so Svelte tracks them
  $: dayClassMap = buildDayClasses(
    daysInMonth, viewYear, viewMonth,
    startDate, endDate, effectiveEnd,
    selectionPhase, hoverDate, today
  );
</script>

<div class="calendar" on:mouseleave={handleMouseLeave} role="application" aria-label="Date range calendar">
  <header class="cal-header">
    <button type="button" class="nav-btn" on:click={prevMonth} aria-label="Previous month">&lsaquo;</button>
    <span class="cal-title">{MONTHS[viewMonth]} {viewYear}</span>
    <button type="button" class="nav-btn" on:click={nextMonth} aria-label="Next month">&rsaquo;</button>
  </header>

  <div class="cal-hint">
    {#if selectionPhase === 'start'}
      Select arrival date
    {:else}
      Select departure date
    {/if}
  </div>

  <div class="cal-grid">
    {#each DAYS as d}
      <span class="dow">{d}</span>
    {/each}

    {#each Array(firstDow) as _}
      <span class="empty"></span>
    {/each}

    {#each Array(daysInMonth) as _, i}
      {@const day = i + 1}
      {@const iso = toIso(viewYear, viewMonth, day)}
      <button
        type="button"
        class={dayClassMap[iso] || 'day'}
        on:click={() => handleDayClick(iso)}
        on:mouseenter={() => handleDayHover(iso)}
        aria-label="{MONTHS[viewMonth]} {day}"
      >{day}</button>
    {/each}
  </div>
</div>

<style>
  .calendar {
    background: #f8fafd;
    border: 1px solid #d6deea;
    border-radius: 12px;
    padding: 0.6rem;
    user-select: none;
  }

  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }

  .cal-title {
    font-weight: 700;
    font-size: 0.9rem;
    color: #1b304a;
  }

  .nav-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 1.2rem;
    color: #455566;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    padding: 0;
    line-height: 1;
  }

  .nav-btn:hover {
    background: #eef3fb;
    border-color: #d6deea;
  }

  .cal-hint {
    text-align: center;
    font-size: 0.78rem;
    color: #5a6f87;
    margin-bottom: 0.35rem;
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }

  .dow {
    text-align: center;
    font-size: 0.72rem;
    font-weight: 700;
    color: #7a8da4;
    padding: 0.25rem 0;
  }

  .empty {
    padding: 0.3rem 0;
  }

  .day {
    display: grid;
    place-items: center;
    padding: 0.3rem 0;
    font-size: 0.82rem;
    font-weight: 500;
    color: #263444;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    padding: 0;
    transition: background 0.1s;
  }

  .day:hover {
    background: #e0eeff;
  }

  .day.today {
    font-weight: 800;
    box-shadow: inset 0 0 0 1.5px #0c5fdb;
  }

  .day.range-start {
    background: #0c5fdb;
    color: white;
    border-radius: 6px 2px 2px 6px;
    font-weight: 700;
  }

  .day.range-end {
    background: #0c5fdb;
    color: white;
    border-radius: 2px 6px 6px 2px;
    font-weight: 700;
  }

  .day.range-start.range-end {
    border-radius: 6px;
  }

  .day.in-range {
    background: #93c5fd;
    color: #1e3a5f;
    border-radius: 0;
    font-weight: 600;
  }

  .day.hover-range {
    background: #bfdbfe;
    color: #1e3a5f;
    border-radius: 0;
  }
</style>
