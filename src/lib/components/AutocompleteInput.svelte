<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Suggestion {
    label: string;
    sublabel?: string;
    data: unknown;
  }

  export let value = '';
  export let suggestions: Suggestion[] = [];
  export let placeholder = '';
  export let required = false;
  export let maxlength: number | undefined = undefined;
  export let testid = '';

  const dispatch = createEventDispatcher<{
    select: { suggestion: Suggestion };
    input: { value: string };
  }>();

  let dropdownOpen = false;
  let selectedIndex = -1;
  let inputEl: HTMLInputElement | null = null;
  let containerEl: HTMLDivElement | null = null;

  $: filteredSuggestions = value.trim()
    ? suggestions.filter((s) => {
        const lower = value.toLowerCase();
        return s.label.toLowerCase().includes(lower) ||
               (s.sublabel && s.sublabel.toLowerCase().includes(lower));
      }).slice(0, 10)
    : [];

  $: if (!value.trim() || filteredSuggestions.length === 0) {
    dropdownOpen = false;
    selectedIndex = -1;
  }

  function handleInput(): void {
    dropdownOpen = value.trim().length > 0 && filteredSuggestions.length > 0;
    selectedIndex = -1;
    dispatch('input', { value });
  }

  function handleFocus(): void {
    dropdownOpen = value.trim().length > 0 && filteredSuggestions.length > 0;
  }

  function selectSuggestion(suggestion: Suggestion): void {
    dropdownOpen = false;
    selectedIndex = -1;
    dispatch('select', { suggestion });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!dropdownOpen || filteredSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredSuggestions.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(filteredSuggestions[selectedIndex]);
    } else if (event.key === 'Escape') {
      dropdownOpen = false;
      selectedIndex = -1;
    }
  }

  function handleBlur(event: FocusEvent): void {
    // Delay to allow click on suggestion to fire first
    setTimeout(() => {
      if (containerEl && !containerEl.contains(document.activeElement)) {
        dropdownOpen = false;
        selectedIndex = -1;
      }
    }, 150);
  }

  function handleDocumentMouseDown(event: MouseEvent): void {
    if (containerEl && event.target instanceof Node && !containerEl.contains(event.target)) {
      dropdownOpen = false;
      selectedIndex = -1;
    }
  }

  export function focus(): void {
    inputEl?.focus();
  }
</script>

<svelte:window on:mousedown={handleDocumentMouseDown} />

<div class="autocomplete-container" bind:this={containerEl}>
  <input
    bind:this={inputEl}
    bind:value
    on:input={handleInput}
    on:focus={handleFocus}
    on:keydown={handleKeydown}
    on:blur={handleBlur}
    type="text"
    {placeholder}
    {required}
    maxlength={maxlength}
    role="combobox"
    aria-expanded={dropdownOpen && filteredSuggestions.length > 0}
    aria-controls="autocomplete-listbox"
    aria-autocomplete="list"
    aria-activedescendant={selectedIndex >= 0 ? `autocomplete-option-${selectedIndex}` : undefined}
    data-testid={testid}
  />
  {#if dropdownOpen && filteredSuggestions.length > 0}
    <ul class="autocomplete-dropdown" id="autocomplete-listbox" role="listbox">
      {#each filteredSuggestions as suggestion, i}
        <li
          class="autocomplete-option"
          class:selected={i === selectedIndex}
          id="autocomplete-option-{i}"
          role="option"
          aria-selected={i === selectedIndex}
          on:mousedown|preventDefault={() => selectSuggestion(suggestion)}
          on:mouseenter={() => { selectedIndex = i; }}
        >
          <span class="option-label">{suggestion.label}</span>
          {#if suggestion.sublabel}
            <span class="option-sublabel">{suggestion.sublabel}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .autocomplete-container {
    position: relative;
    width: 100%;
  }

  input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #c8d1de;
    padding: 0.6rem 0.75rem;
    background: white;
    color: #102033;
    font: inherit;
  }

  .autocomplete-dropdown {
    position: static;
    background: white;
    border: 1px solid #d6deea;
    border-radius: 12px;
    box-shadow: 0 12px 36px rgba(10, 24, 47, 0.14);
    max-height: 16rem;
    overflow-y: auto;
    list-style: none;
    margin: 0.35rem 0 0;
    padding: 0.35rem;
  }

  .autocomplete-option {
    display: grid;
    gap: 0.1rem;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .autocomplete-option:hover,
  .autocomplete-option.selected {
    background: #eef3fb;
  }

  .option-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1b304a;
  }

  .option-sublabel {
    font-size: 0.82rem;
    color: #5a6f87;
  }
</style>
