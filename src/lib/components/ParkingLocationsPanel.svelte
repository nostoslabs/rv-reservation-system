<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let locations: string[] = [];
  export let reservationCounts: Record<string, number> = {};
  export let errorMessage = '';

  const dispatch = createEventDispatcher<{
    add: { name: string };
    rename: { oldName: string; newName: string };
    remove: { name: string };
    clearerror: void;
  }>();

  let newLocationName = '';
  let renameDrafts: Record<string, string> = {};

  $: {
    const next: Record<string, string> = {};
    for (const location of locations) {
      next[location] = renameDrafts[location] ?? location;
    }
    const changed =
      Object.keys(next).length !== Object.keys(renameDrafts).length ||
      Object.entries(next).some(([key, value]) => renameDrafts[key] !== value);
    if (changed) {
      renameDrafts = next;
    }
  }

  function submitAdd(): void {
    dispatch('add', { name: newLocationName });
    newLocationName = '';
  }

  function submitRename(oldName: string): void {
    dispatch('rename', { oldName, newName: renameDrafts[oldName] ?? oldName });
  }
</script>

<section class="panel" aria-labelledby="parking-locations-title">
  <div class="panel-header">
    <h2 id="parking-locations-title">Parking Locations</h2>
    <p>Manage rows shown in the working sheet.</p>
  </div>

  {#if errorMessage}
    <div class="panel-error" role="alert">
      <span>{errorMessage}</span>
      <button type="button" on:click={() => dispatch('clearerror')}>Dismiss</button>
    </div>
  {/if}

  <form class="add-form" on:submit|preventDefault={submitAdd}>
    <input bind:value={newLocationName} type="text" placeholder="Add parking location" maxlength="40" />
    <button type="submit">Add</button>
  </form>

  <ul class="location-list">
    {#each locations as location}
      <li>
        <div class="location-row">
          <input bind:value={renameDrafts[location]} type="text" maxlength="40" aria-label={`Rename ${location}`} />
          <span class="count">{reservationCounts[location] ?? 0} reservations</span>
          <button type="button" on:click={() => submitRename(location)}>Rename</button>
          <button type="button" class="danger" on:click={() => dispatch('remove', { name: location })}>
            Delete
          </button>
        </div>
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
    color: #5f6e80;
    font-size: 0.85rem;
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
    padding: 0.5rem 0.6rem;
    background: white;
    color: #13263c;
  }

  .add-form button,
  .location-row button {
    border-radius: 10px;
    border: 1px solid #c2ccdb;
    background: #f4f7fb;
    color: #223349;
    padding: 0.5rem 0.7rem;
    cursor: pointer;
  }

  .location-row button.danger {
    background: #fff0f0;
    color: #8d2b2b;
    border-color: #efb8b8;
  }

  .location-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.45rem;
    max-height: 22rem;
    overflow: auto;
  }

  .location-row {
    display: grid;
    grid-template-columns: minmax(8rem, 1fr) auto auto auto;
    gap: 0.45rem;
    align-items: center;
  }

  .count {
    color: #617184;
    font-size: 0.8rem;
    min-width: 7.5rem;
    text-align: right;
  }

  @media (max-width: 900px) {
    .location-row {
      grid-template-columns: 1fr 1fr;
    }

    .count {
      min-width: 0;
      text-align: left;
    }
  }
</style>
