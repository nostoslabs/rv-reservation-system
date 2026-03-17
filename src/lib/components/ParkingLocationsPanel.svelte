<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';

  export let locations: string[] = [];
  export let reservationCounts: Record<string, number> = {};
  export let errorMessage = '';

  const dispatch = createEventDispatcher<{
    add: { name: string };
    rename: { oldName: string; newName: string };
    remove: { name: string };
    reorder: { orderedNames: string[] };
    clearerror: void;
  }>();

  let newLocationName = '';
  let openMenu: string | null = null;
  let editingLocation: string | null = null;
  let editDraft = '';
  let confirmingDelete: string | null = null;

  // Pointer-based drag state
  let dragIndex: number | null = null;
  let dropTargetIndex: number | null = null;
  let listEl: HTMLUListElement;

  function submitAdd(): void {
    dispatch('add', { name: newLocationName });
    newLocationName = '';
  }

  function toggleMenu(location: string): void {
    if (openMenu === location) {
      openMenu = null;
    } else {
      openMenu = location;
      confirmingDelete = null;
    }
  }

  function startRename(location: string): void {
    editingLocation = location;
    editDraft = location;
    openMenu = null;
  }

  function submitRename(oldName: string): void {
    dispatch('rename', { oldName, newName: editDraft });
    editingLocation = null;
    editDraft = '';
  }

  function cancelRename(): void {
    editingLocation = null;
    editDraft = '';
  }

  function startDelete(location: string): void {
    confirmingDelete = location;
    openMenu = null;
  }

  function confirmDelete(location: string): void {
    dispatch('remove', { name: location });
    confirmingDelete = null;
  }

  function cancelDelete(): void {
    confirmingDelete = null;
  }

  function handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (openMenu && !target.closest('.kebab-wrapper')) {
      openMenu = null;
    }
  }

  // Move up/down helpers (kebab menu actions)
  function moveUp(index: number): void {
    if (index <= 0) return;
    const reordered = [...locations];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    dispatch('reorder', { orderedNames: reordered });
    openMenu = null;
  }

  function moveDown(index: number): void {
    if (index >= locations.length - 1) return;
    const reordered = [...locations];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    dispatch('reorder', { orderedNames: reordered });
    openMenu = null;
  }

  // Pointer-based drag reorder (works in Tauri WKWebView unlike HTML5 DnD)
  function getItemIndexAtY(clientY: number): number | null {
    if (!listEl) return null;
    const items = listEl.querySelectorAll(':scope > li');
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return i;
      }
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent, index: number): void {
    if (editingLocation !== null || confirmingDelete !== null) return;
    event.preventDefault();
    dragIndex = index;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (dragIndex === null) return;
    const hoverIndex = getItemIndexAtY(event.clientY);
    if (hoverIndex !== null && hoverIndex !== dragIndex) {
      dropTargetIndex = hoverIndex;
    } else {
      dropTargetIndex = null;
    }
  }

  function handlePointerUp(event: PointerEvent): void {
    if (dragIndex === null) return;
    if (dropTargetIndex !== null && dropTargetIndex !== dragIndex) {
      const reordered = [...locations];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dropTargetIndex, 0, moved);
      dispatch('reorder', { orderedNames: reordered });
    }
    dragIndex = null;
    dropTargetIndex = null;
  }
</script>

<svelte:window on:click={handleClickOutside} />

<section class="panel" aria-labelledby="parking-locations-title">
  <div class="panel-header">
    <h2 id="parking-locations-title">Sites</h2>
    <p>Manage rows shown in the schedule. Drag the grip to reorder.</p>
  </div>

  {#if errorMessage}
    <div class="panel-error" role="alert">
      <span>{errorMessage}</span>
      <button type="button" on:click={() => dispatch('clearerror')}>Dismiss</button>
    </div>
  {/if}

  <form class="add-form" on:submit|preventDefault={submitAdd}>
    <input bind:value={newLocationName} type="text" placeholder="Add site" aria-label="Add site" maxlength="40" />
    <button type="submit">Add</button>
  </form>

  <ul class="location-list" bind:this={listEl}>
    {#each locations as location, i}
      <li
        class:drag-over-above={dropTargetIndex === i && dragIndex !== null && dragIndex > i}
        class:drag-over-below={dropTargetIndex === i && dragIndex !== null && dragIndex < i}
        class:dragging={dragIndex === i}
      >
        {#if editingLocation === location}
          <div class="location-row editing">
            <input
              bind:value={editDraft}
              type="text"
              maxlength="40"
              aria-label={`Rename ${location}`}
              on:keydown={(e) => { if (e.key === 'Escape') cancelRename(); }}
            />
            <button type="button" class="save-btn" on:click={() => submitRename(location)}>Save</button>
            <button type="button" on:click={cancelRename}>Cancel</button>
          </div>
        {:else if confirmingDelete === location}
          <div class="location-row confirm-delete">
            <span class="confirm-text">
              Delete <strong>{location}</strong> and {reservationCounts[location] ?? 0} reservations?
            </span>
            <button type="button" class="danger" on:click={() => confirmDelete(location)}>Yes</button>
            <button type="button" on:click={cancelDelete}>No</button>
          </div>
        {:else}
          <div class="location-row">
            <span
              class="drag-handle"
              role="button"
              tabindex="0"
              aria-label={`Reorder ${location}`}
              title="Drag to reorder"
              on:pointerdown={(e) => handlePointerDown(e, i)}
              on:pointermove={handlePointerMove}
              on:pointerup={handlePointerUp}
            >&#x2630;</span>
            <span class="location-name">{location}</span>
            <span class="count">{reservationCounts[location] ?? 0} reservations</span>
            <div class="kebab-wrapper">
              <button
                type="button"
                class="kebab-btn"
                aria-label={`Actions for ${location}`}
                on:click|stopPropagation={() => toggleMenu(location)}
              >&#x22EE;</button>
              {#if openMenu === location}
                <div class="kebab-menu" role="menu">
                  {#if i > 0}
                    <button type="button" role="menuitem" on:click|stopPropagation={() => moveUp(i)}>Move Up</button>
                  {/if}
                  {#if i < locations.length - 1}
                    <button type="button" role="menuitem" on:click|stopPropagation={() => moveDown(i)}>Move Down</button>
                  {/if}
                  <button type="button" role="menuitem" on:click|stopPropagation={() => startRename(location)}>Rename</button>
                  <button type="button" role="menuitem" class="menu-danger" on:click|stopPropagation={() => startDelete(location)}>Delete</button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .panel {
    background: white;
    border: 1px solid #d8dfeb;
    border-radius: 14px;
    padding: 0.9rem;
    display: grid;
    gap: 0.8rem;
    box-shadow: 0 8px 24px rgba(15, 28, 47, 0.05);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1rem;
  }

  .panel-header p {
    margin: 0.2rem 0 0;
    color: #455566;
    font-size: 0.95rem;
  }

  .panel-error {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: space-between;
    border: 1px solid #f2c0b4;
    background: #fff4ef;
    color: #7a3b22;
    border-radius: 10px;
    padding: 0.55rem 0.65rem;
    font-size: 0.85rem;
  }

  .panel-error button {
    border: 0;
    background: transparent;
    color: inherit;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
  }

  .add-form {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }

  .add-form input,
  .add-form button,
  .location-row input,
  .location-row button {
    font: inherit;
  }

  .add-form input,
  .location-row input {
    border-radius: 10px;
    border: 1px solid #c7d0dd;
    padding: 0.6rem 0.75rem;
    background: white;
    color: #13263c;
  }

  .add-form button,
  .location-row button {
    border-radius: 10px;
    border: 1px solid #c2ccdb;
    background: #f4f7fb;
    color: #223349;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    min-height: 44px;
  }

  .location-row button.danger {
    background: #fff0f0;
    color: #8d2b2b;
    border-color: #efb8b8;
  }

  .location-row button.save-btn {
    background: #0c5fdb;
    border-color: #0c5fdb;
    color: white;
  }

  .location-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.45rem;
    max-height: min(32rem, 60vh);
    overflow-y: auto;
  }

  .location-list li {
    border-radius: 8px;
    transition: box-shadow 0.12s;
  }

  .location-list li.dragging {
    opacity: 0.4;
  }

  .location-list li.drag-over-above {
    box-shadow: 0 -2px 0 0 #0c5fdb;
  }

  .location-list li.drag-over-below {
    box-shadow: 0 2px 0 0 #0c5fdb;
  }

  .location-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 0.4rem;
    align-items: center;
  }

  .location-row.editing,
  .location-row.confirm-delete {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .drag-handle {
    color: #9aa8b8;
    font-size: 0.85rem;
    cursor: grab;
    user-select: none;
    touch-action: none;
    padding: 0.3rem 0.15rem;
    line-height: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .location-name {
    font-weight: 600;
    color: #1b304a;
    padding: 0.3rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    color: #4a5568;
    font-size: 0.875rem;
    white-space: nowrap;
    text-align: right;
  }

  .confirm-text {
    font-size: 0.9rem;
    color: #7a3b22;
  }

  .kebab-wrapper {
    position: relative;
  }

  .kebab-btn {
    border: 1px solid transparent;
    background: transparent;
    color: #455566;
    font-size: 1.2rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    min-height: 44px;
    min-width: 44px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    line-height: 1;
  }

  .kebab-btn:hover {
    background: #f0f4fa;
    border-color: #d6deea;
  }

  .kebab-menu {
    position: absolute;
    right: 0;
    top: 100%;
    background: white;
    border: 1px solid #d6deea;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(15, 28, 47, 0.12);
    z-index: 20;
    min-width: 120px;
    overflow: hidden;
  }

  .kebab-menu button {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 0;
    background: white;
    color: #1b304a;
    padding: 0.6rem 0.85rem;
    text-align: left;
    cursor: pointer;
    font-size: 0.9rem;
    min-height: 44px;
  }

  .kebab-menu button:hover {
    background: #f0f4fa;
  }

  .kebab-menu button.menu-danger {
    color: #8d2b2b;
  }

  .kebab-menu button.menu-danger:hover {
    background: #fff0f0;
  }

  @media (max-width: 900px) {
    .location-row {
      grid-template-columns: auto minmax(0, 1fr) auto auto;
    }

    .count {
      min-width: 0;
      text-align: left;
    }
  }
</style>
