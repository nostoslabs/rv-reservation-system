<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { formatReservationDetail } from '$lib/date';
  import { filterReservations } from '$lib/domain/reservations/search';
  import type { Reservation } from '$lib/types';

  export let reservations: Reservation[] = [];

  const dispatch = createEventDispatcher<{
    select: Reservation;
  }>();

  let searchQuery = '';
  let searchOpen = false;
  let searchInputEl: HTMLInputElement | null = null;
  let searchContainerEl: HTMLDivElement | null = null;
  let selectedSearchIndex = -1;

  $: searchResults = filterReservations(reservations, searchQuery);
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
      selectReservation(searchResults[selectedSearchIndex].reservation);
    }
  }

  function selectReservation(reservation: Reservation): void {
    searchOpen = false;
    searchQuery = '';
    dispatch('select', reservation);
  }

  function handleSearchClickOutside(event: MouseEvent): void {
    if (searchContainerEl && !searchContainerEl.contains(event.target as Node)) {
      searchOpen = false;
    }
  }
</script>

<svelte:window on:click={handleSearchClickOutside} />

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
          on:click={() => selectReservation(result.reservation)}
          on:keydown={(e) => { if (e.key === 'Enter') selectReservation(result.reservation); }}
          on:mouseenter={() => { selectedSearchIndex = i; }}
        >
          <span class="search-result-name">{result.reservation.name}</span>
          <span class="search-result-meta">
            <span class="search-result-location">{result.reservation.parkingLocation}</span>
            {#if result.reservation.rvType}
              <span class="search-result-rvtype">{result.reservation.rvType}</span>
            {/if}
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

<style>
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

  .search-result-rvtype {
    color: #6b7d93;
  }

  .search-result-phone {
    color: #7a8da3;
    font-style: italic;
  }

  @media (max-width: 1100px) {
    .search-container {
      min-width: 0;
    }
  }
</style>
