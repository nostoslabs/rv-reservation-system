<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let locations: string[] = [];
  export let reservationCounts: Record<string, number> = {};
  export let errorMessage = '';
  /** When non-empty, site management controls are locked until this passcode is entered. */
  export let adminPasscode: string = '';

  const dispatch = createEventDispatcher<{
    add: { name: string };
    rename: { oldName: string; newName: string };
    remove: { name: string };
    clearerror: void;
  }>();

  let newLocationName = '';
  let openMenu: string | null = null;
  let editingLocation: string | null = null;
  let editDraft = '';
  let confirmingDelete: string | null = null;

  // Lock state — when a passcode is configured, site editing starts locked.
  let siteEditUnlocked = false;
  let passcodeEntry = '';
  let passcodeError = '';

  $: isLocked = adminPasscode.length > 0 && !siteEditUnlocked;

  // If the passcode is removed (e.g. on admin page), reset locked state.
  $: if (adminPasscode.length === 0) {
    siteEditUnlocked = false;
    passcodeEntry = '';
    passcodeError = '';
    openMenu = null;
    editingLocation = null;
  }

  function handleUnlockSites(): void {
    if (passcodeEntry === adminPasscode) {
      siteEditUnlocked = true;
      passcodeEntry = '';
      passcodeError = '';
    } else {
      passcodeError = 'Incorrect passcode.';
    }
  }

  function handleLockSites(): void {
    siteEditUnlocked = false;
    passcodeEntry = '';
    passcodeError = '';
    openMenu = null;
    editingLocation = null;
  }

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
</script>

<svelte:window on:click={handleClickOutside} />

<section class="panel" aria-labelledby="parking-locations-title">
  <div class="panel-header">
    <h2 id="parking-locations-title">Sites</h2>
    <p>Manage rows shown in the schedule.</p>
  </div>

  {#if errorMessage}
    <div class="panel-error" role="alert">
      <span>{errorMessage}</span>
      <button type="button" on:click={() => dispatch('clearerror')}>Dismiss</button>
    </div>
  {/if}

  {#if isLocked}
    <!-- Locked state: read-only site list + passcode entry -->
    <ul class="location-list">
      {#each locations as location}
        <li>
          <div class="location-row readonly">
            <span class="location-name">{location}</span>
            <span class="count">{reservationCounts[location] ?? 0} reservations</span>
          </div>
        </li>
      {/each}
    </ul>

    <form class="unlock-form" on:submit|preventDefault={handleUnlockSites} data-testid="sites-unlock-form">
      <span class="lock-label">🔒 Enter passcode to manage sites</span>
      {#if passcodeError}
        <span class="unlock-error" role="alert">{passcodeError}</span>
      {/if}
      <div class="unlock-row">
        <input
          bind:value={passcodeEntry}
          type="password"
          placeholder="Passcode"
          maxlength="64"
          aria-label="Admin passcode to unlock site management"
          data-testid="sites-passcode-input"
        />
        <button type="submit" data-testid="sites-unlock-btn">Unlock</button>
      </div>
    </form>
  {:else}
    <!-- Unlocked state: full management UI -->
    <form class="add-form" on:submit|preventDefault={submitAdd}>
      <input bind:value={newLocationName} type="text" placeholder="Add site" maxlength="40" />
      <button type="submit">Add</button>
    </form>

    <ul class="location-list">
      {#each locations as location}
        <li>
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
              <span class="location-name">{location}</span>
              <span class="count">{reservationCounts[location] ?? 0} reservations</span>
              <div class="kebab-wrapper">
                <button
                  type="button"
                  class="kebab-btn"
                  aria-label={`Actions for ${location}`}
                  on:click|stopPropagation={() => toggleMenu(location)}
                >⋮</button>
                {#if openMenu === location}
                  <div class="kebab-menu" role="menu">
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

    {#if adminPasscode.length > 0}
      <button type="button" class="lock-btn" on:click={handleLockSites} data-testid="sites-lock-btn">
        🔒 Lock Site Management
      </button>
    {/if}
  {/if}
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

  .location-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.4rem;
    align-items: center;
  }

  .location-row.editing,
  .location-row.confirm-delete {
    grid-template-columns: minmax(0, 1fr) auto auto;
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
      grid-template-columns: minmax(0, 1fr) auto auto;
    }

    .count {
      min-width: 0;
      text-align: left;
    }
  }

  .location-row.readonly {
    grid-template-columns: minmax(0, 1fr) auto;
    cursor: default;
  }

  .unlock-form {
    display: grid;
    gap: 0.45rem;
  }

  .lock-label {
    font-size: 0.85rem;
    color: #455566;
    font-weight: 600;
  }

  .unlock-error {
    font-size: 0.82rem;
    color: #842828;
  }

  .unlock-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }

  .unlock-row input {
    border-radius: 10px;
    border: 1px solid #c7d0dd;
    padding: 0.55rem 0.7rem;
    background: white;
    color: #13263c;
    font: inherit;
  }

  .unlock-row button {
    border-radius: 10px;
    border: 1px solid #c2ccdb;
    background: #f4f7fb;
    color: #223349;
    padding: 0.55rem 0.75rem;
    cursor: pointer;
    min-height: 44px;
    font: inherit;
  }

  .lock-btn {
    border: 1px solid #d6deea;
    background: #f8fafd;
    color: #455566;
    border-radius: 10px;
    padding: 0.45rem 0.7rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;
    width: fit-content;
  }

  .lock-btn:hover {
    background: #eef3fb;
    border-color: #c2ccdb;
  }
</style>
