<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { MAX_RESERVATION_NOTES_LENGTH } from '$lib/reservations';
  import { RESERVATION_COLORS, type ReservationFormValues } from '$lib/types';

  export let open = false;
  export let mode: 'create' | 'edit' = 'create';
  export let parkingLocations: string[] = [];
  export let draft: ReservationFormValues = {
    name: '',
    phoneNumber: '',
    notes: '',
    startDate: '',
    endDate: '',
    parkingLocation: '',
    color: 'blue'
  };
  export let errors: string[] = [];

  const dispatch = createEventDispatcher<{
    save: ReservationFormValues;
    cancel: void;
    delete: { index: number };
  }>();

  const emptyExtras = { phoneNumber: '', notes: '' };
  let form: ReservationFormValues = { ...emptyExtras, ...draft };

  $: if (open) {
    form = { ...emptyExtras, ...draft };
  }

  function handleSubmit(): void {
    dispatch('save', { ...form });
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (event.currentTarget === event.target) {
      dispatch('cancel');
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      dispatch('cancel');
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="modal-backdrop" role="presentation" on:click={handleOverlayClick}>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title">
      <header class="modal-header">
        <h2 id="reservation-modal-title">{mode === 'create' ? 'New Reservation' : 'Edit Reservation'}</h2>
        {#if mode === 'edit' && typeof form.index === 'number'}
          <p class="meta">Reservation #{form.index}</p>
        {/if}
      </header>

      {#if errors.length > 0}
        <div class="error-box" role="alert">
          <strong>Fix these issues:</strong>
          <ul>
            {#each errors as error}
              <li>{error}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <form class="modal-form" on:submit|preventDefault={handleSubmit}>
        <label>
          <span>Name</span>
          <input bind:value={form.name} type="text" placeholder="Guest name" required maxlength="80" />
        </label>

        <label>
          <span>Phone Number</span>
          <input bind:value={form.phoneNumber} type="tel" placeholder="(555) 555-5555" maxlength="40" />
        </label>

        <div class="row-2">
          <label>
            <span>Start Date</span>
            <input bind:value={form.startDate} type="date" required />
          </label>
          <label>
            <span>End Date</span>
            <input bind:value={form.endDate} type="date" required />
          </label>
        </div>

        <div class="row-2">
          <label>
            <span>Parking Location</span>
            <select bind:value={form.parkingLocation} required>
              {#each parkingLocations as location}
                <option value={location}>{location}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Color</span>
            <select bind:value={form.color} required>
              {#each RESERVATION_COLORS as color}
                <option value={color}>{color}</option>
              {/each}
            </select>
          </label>
        </div>

        <label>
          <span class="notes-label-row">
            <span>Notes</span>
            <small>{form.notes.length}/{MAX_RESERVATION_NOTES_LENGTH}</small>
          </span>
          <textarea
            bind:value={form.notes}
            rows="3"
            maxlength={MAX_RESERVATION_NOTES_LENGTH}
            placeholder="Optional notes"
          ></textarea>
        </label>

        <footer class="modal-actions">
          <button type="submit" class="primary">Save</button>
          <button type="button" on:click={() => dispatch('cancel')}>Cancel</button>
          {#if mode === 'edit' && typeof form.index === 'number'}
            <button
              type="button"
              class="danger"
              on:click={() => dispatch('delete', { index: form.index as number })}
            >
              Delete
            </button>
          {/if}
        </footer>
      </form>
    </section>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(7, 11, 20, 0.5);
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 100;
  }

  .modal {
    width: min(38rem, 100%);
    background: white;
    border-radius: 14px;
    border: 1px solid #d7dce4;
    box-shadow: 0 24px 60px rgba(12, 24, 46, 0.18);
    padding: 1rem;
  }

  .modal-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .meta {
    margin: 0;
    color: #5d6a7b;
    font-size: 0.85rem;
  }

  .error-box {
    border: 1px solid #f1a2a2;
    background: #fff1f1;
    color: #7a1e1e;
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    margin-bottom: 0.75rem;
  }

  .error-box ul {
    margin: 0.4rem 0 0;
    padding-left: 1.2rem;
  }

  .modal-form {
    display: grid;
    gap: 0.8rem;
  }

  .row-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  label {
    display: grid;
    gap: 0.35rem;
    font-weight: 600;
    color: #263444;
    font-size: 0.9rem;
  }

  label span {
    display: block;
  }

  input,
  select,
  textarea,
  button {
    font: inherit;
  }

  input,
  select,
  textarea {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #c8d1de;
    padding: 0.55rem 0.65rem;
    background: white;
    color: #102033;
  }

  textarea {
    resize: vertical;
    min-height: 5.5rem;
  }

  .notes-label-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }

  .notes-label-row small {
    color: #607084;
    font-weight: 600;
    font-size: 0.78rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.55rem;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }

  button {
    border-radius: 10px;
    border: 1px solid #c1cada;
    background: #f6f8fb;
    color: #203045;
    padding: 0.55rem 0.8rem;
    cursor: pointer;
  }

  button.primary {
    background: #0c5fdb;
    border-color: #0c5fdb;
    color: white;
  }

  button.danger {
    background: #fbeaea;
    border-color: #efb2b2;
    color: #892727;
  }

  @media (max-width: 640px) {
    .row-2 {
      grid-template-columns: 1fr;
    }

    .modal-actions {
      flex-wrap: wrap;
      justify-content: stretch;
    }

    .modal-actions button {
      flex: 1 1 30%;
    }
  }
</style>
