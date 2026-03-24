<script lang="ts">
  import { createEventDispatcher, afterUpdate } from 'svelte';
  import { MAX_CUSTOMER_NOTES_LENGTH } from '$lib/domain/customers';
  import type { CustomerFormValues } from '$lib/domain/customers';

  export let open = false;
  export let mode: 'create' | 'edit' = 'create';
  export let draft: CustomerFormValues = {
    name: '',
    phone: '',
    rvType: '',
    email: '',
    notes: ''
  };
  export let errors: string[] = [];

  const dispatch = createEventDispatcher<{
    save: CustomerFormValues;
    cancel: void;
    delete: { id: string };
  }>();

  let form: CustomerFormValues = { ...draft };
  let confirmingDelete = false;
  let nameInput: HTMLInputElement | null = null;
  let wasOpen = false;

  $: if (open) {
    form = { ...draft };
    confirmingDelete = false;
  }

  afterUpdate(() => {
    if (open && !wasOpen && nameInput) {
      nameInput.focus();
    }
    wasOpen = open;
  });

  function handleClose(): void {
    dispatch('cancel');
  }

  function handleSubmit(): void {
    dispatch('save', { ...form });
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (event.currentTarget === event.target) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      if (confirmingDelete) {
        confirmingDelete = false;
      } else {
        handleClose();
      }
    }
  }

  function handleDeleteClick(): void {
    if (confirmingDelete) {
      dispatch('delete', { id: form.id as string });
    } else {
      confirmingDelete = true;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="modal-backdrop" role="presentation" on:click={handleOverlayClick}>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
      <header class="modal-header">
        <h2 id="customer-modal-title">{mode === 'create' ? 'New Customer' : 'Edit Customer'}</h2>
        <button
          type="button"
          class="close-button"
          aria-label="Close modal"
          on:click={handleClose}
        >&times;</button>
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
          <input
            bind:this={nameInput}
            bind:value={form.name}
            type="text"
            placeholder="Customer name"
            required
            maxlength="80"
            data-testid="customer-name-input"
          />
        </label>

        <label>
          <span>Phone</span>
          <input
            bind:value={form.phone}
            type="tel"
            placeholder="(555) 555-5555"
            maxlength="40"
            data-testid="customer-phone-input"
          />
        </label>

        <label>
          <span>RV Type</span>
          <input
            bind:value={form.rvType}
            type="text"
            placeholder="e.g. Fifth Wheel, Class A, Travel Trailer"
            maxlength="60"
            data-testid="customer-rv-type-input"
          />
        </label>

        <label>
          <span>Email</span>
          <input
            bind:value={form.email}
            type="email"
            placeholder="email@example.com"
            maxlength="120"
            data-testid="customer-email-input"
          />
        </label>

        <label>
          <span class="notes-label-row">
            <span>Notes</span>
            <small>{form.notes.length}/{MAX_CUSTOMER_NOTES_LENGTH}</small>
          </span>
          <textarea
            bind:value={form.notes}
            rows="3"
            maxlength={MAX_CUSTOMER_NOTES_LENGTH}
            placeholder="Optional notes (e.g. prefers pull-through)"
            data-testid="customer-notes-input"
          ></textarea>
        </label>

        <footer class="modal-actions">
          {#if mode === 'edit' && form.id}
            <div class="delete-zone">
              <button
                type="button"
                class={confirmingDelete ? 'danger confirming' : 'danger'}
                on:click={handleDeleteClick}
                data-testid="customer-delete-btn"
              >
                {confirmingDelete ? 'Confirm Delete?' : 'Delete'}
              </button>
            </div>
          {/if}
          <div class="save-cancel">
            <button type="button" on:click={handleClose}>Cancel</button>
            <button type="submit" class="primary" data-testid="customer-save-btn">Save</button>
          </div>
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
    position: relative;
    width: min(32rem, 100%);
    max-height: min(90vh, 52rem);
    overflow-y: auto;
    background: white;
    border-radius: 14px;
    border: 1px solid #d7dce4;
    box-shadow: 0 24px 60px rgba(12, 24, 46, 0.18);
    padding: 1rem;
  }

  .modal-header {
    position: sticky;
    top: -1rem;
    background: white;
    z-index: 10;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin: -1rem -1rem 0;
    padding: 1rem 1rem 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    color: #6b7a8d;
    cursor: pointer;
    padding: 0.15rem 0.4rem;
    border-radius: 6px;
    min-height: 32px;
    min-width: 32px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .close-button:hover {
    background: #f0f3f7;
    color: #1b304a;
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
  textarea,
  button {
    font: inherit;
  }

  input,
  textarea {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #c8d1de;
    padding: 0.6rem 0.75rem;
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
    color: #455566;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.55rem;
    margin-top: 0.25rem;
  }

  .delete-zone {
    flex-shrink: 0;
  }

  .save-cancel {
    display: flex;
    gap: 0.55rem;
    margin-left: auto;
  }

  button {
    border-radius: 10px;
    border: 1px solid #c1cada;
    background: #f6f8fb;
    color: #203045;
    padding: 0.6rem 0.85rem;
    cursor: pointer;
    min-height: 44px;
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

  button.danger.confirming {
    background: #d42a2a;
    border-color: #b91c1c;
    color: white;
    font-weight: 700;
  }

  @media (max-width: 640px) {
    .modal-actions {
      flex-wrap: wrap;
    }

    .delete-zone {
      width: 100%;
    }

    .delete-zone button {
      width: 100%;
    }

    .save-cancel {
      width: 100%;
    }

    .save-cancel button {
      flex: 1;
    }
  }
</style>
