<script lang="ts">
  import { createEventDispatcher, afterUpdate } from 'svelte';
  import { addDays, compareIsoDates, diffDays } from '$lib/date';
  import { MAX_RESERVATION_NOTES_LENGTH } from '$lib/reservations';
  import { STATUS_LABELS, getStatusSwatchStyle } from '$lib/domain/reservations/status';
  import { RESERVATION_STATUSES, type ReservationFormValues, type ReservationStatus } from '$lib/types';
  import type { Customer } from '$lib/domain/customers';
  import AutocompleteInput from './AutocompleteInput.svelte';
  import DateRangeCalendar from './DateRangeCalendar.svelte';

  export let open = false;
  export let mode: 'create' | 'edit' = 'create';
  export let parkingLocations: string[] = [];
  export let customers: Customer[] = [];
  export let draft: ReservationFormValues = {
    name: '',
    rvType: '',
    phoneNumber: '',
    notes: '',
    startDate: '',
    endDate: '',
    parkingLocation: '',
    color: 'blue',
    status: 'reserved'
  };
  export let errors: string[] = [];
  /** Element that triggered the modal open, used for focus return on close. */
  export let triggerElement: HTMLElement | null = null;

  const dispatch = createEventDispatcher<{
    save: ReservationFormValues;
    cancel: void;
    delete: { index: number };
    bookagain: ReservationFormValues;
  }>();

  const emptyExtras = { phoneNumber: '', rvType: '', notes: '' };
  let form: ReservationFormValues = { ...emptyExtras, ...draft };
  let confirmingDelete = false;
  let autocompleteRef: AutocompleteInput;
  let wasOpen = false;

  $: customerSuggestions = customers.map((c) => ({
    label: c.name,
    sublabel: [c.rvType, c.phone].filter(Boolean).join(' \u00b7 ') || c.email || undefined,
    data: c
  }));

  function handleCustomerSelect(event: CustomEvent<{ suggestion: { label: string; sublabel?: string; data: unknown } }>): void {
    const customer = event.detail.suggestion.data as Customer;
    form.name = customer.name;
    form.rvType = customer.rvType || form.rvType;
    form.phoneNumber = customer.phone || form.phoneNumber;
    form.customerId = customer.id;
  }

  /** Computed nights display */
  $: nightsCount = (form.startDate && form.endDate)
    ? diffDays(form.startDate, form.endDate)
    : null;
  $: nightsLabel = nightsCount !== null && nightsCount > 0
    ? `${nightsCount} night${nightsCount === 1 ? '' : 's'}`
    : null;

  // When start date changes, auto-advance end date if it's empty or before start
  let lastStartDate = '';
  $: if (form.startDate && form.startDate !== lastStartDate) {
    lastStartDate = form.startDate;
    if (!form.endDate || compareIsoDates(form.endDate, form.startDate) <= 0) {
      form.endDate = addDays(form.startDate, 1);
    }
  }

  $: if (open) {
    form = { ...emptyExtras, ...draft };
    lastStartDate = '';  // Allow auto-advance to run on open if endDate is invalid
    confirmingDelete = false;
  }

  afterUpdate(() => {
    // Focus guest name input when modal just opened
    if (open && !wasOpen && autocompleteRef) {
      autocompleteRef.focus({ suppressDropdown: mode === 'edit' });
    }
    wasOpen = open;
  });

  function returnFocusToTrigger(): void {
    if (triggerElement) {
      requestAnimationFrame(() => {
        triggerElement?.focus();
      });
    }
  }

  function handleClose(): void {
    dispatch('cancel');
    returnFocusToTrigger();
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
      dispatch('delete', { index: form.index as number });
      returnFocusToTrigger();
    } else {
      confirmingDelete = true;
    }
  }

  function handleDateRangeChange(event: CustomEvent<{ startDate: string; endDate: string }>): void {
    form.startDate = event.detail.startDate;
    form.endDate = event.detail.endDate;
  }

  function handleBookAgain(): void {
    dispatch('bookagain', {
      name: form.name,
      rvType: form.rvType,
      phoneNumber: form.phoneNumber,
      notes: form.notes,
      parkingLocation: form.parkingLocation,
      color: form.color,
      status: 'reserved',
      startDate: '',
      endDate: '',
      customerId: form.customerId
    });
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="modal-backdrop" role="presentation" on:click={handleOverlayClick}>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title">
      <header class="modal-header">
        <div class="modal-header-text">
          <h2 id="reservation-modal-title">{mode === 'create' ? 'New Reservation' : 'Edit Reservation'}</h2>
          {#if mode === 'edit' && typeof form.index === 'number'}
            <p class="meta">Reservation #{form.index}</p>
          {/if}
        </div>
        <button
          type="button"
          class="close-button"
          aria-label="Close modal"
          data-testid="modal-close-button"
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
        <div class="form-columns">
          <div class="column-left">
            <DateRangeCalendar
              startDate={form.startDate}
              endDate={form.endDate}
              on:change={handleDateRangeChange}
            />

            <div class="date-row">
              <label class="date-label">
                <span>Arrival</span>
                <input bind:value={form.startDate} type="date" required />
              </label>
              <label class="date-label">
                <span>Departure</span>
                <input
                  bind:value={form.endDate}
                  type="date"
                  required
                  min={form.startDate ? addDays(form.startDate, 1) : undefined}
                />
              </label>
              {#if nightsLabel}
                <span class="nights-badge" data-testid="nights-display">{nightsLabel}</span>
              {/if}
            </div>
          </div>

          <div class="column-right">
            <label>
              <span>Name</span>
              <AutocompleteInput
                bind:this={autocompleteRef}
                bind:value={form.name}
                suggestions={customerSuggestions}
                placeholder="Guest name"
                required
                maxlength={80}
                testid="guest-name-input"
                on:select={handleCustomerSelect}
              />
            </label>

            <label>
              <span>RV Type</span>
              <input bind:value={form.rvType} type="text" placeholder="e.g. Fifth Wheel, Class A" maxlength="60" data-testid="rv-type-input" />
            </label>

            <label>
              <span>Phone Number</span>
              <input bind:value={form.phoneNumber} type="tel" placeholder="(555) 555-5555" maxlength="40" />
            </label>

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

            <label>
              <span>Status</span>
              <div class="status-select-wrapper">
                <span
                  class="status-indicator"
                  style={getStatusSwatchStyle(form.status)}
                  aria-hidden="true"
                ></span>
                <select bind:value={form.status} required aria-label="Reservation status">
                  {#each RESERVATION_STATUSES as statusValue}
                    <option value={statusValue}>{STATUS_LABELS[statusValue]}</option>
                  {/each}
                </select>
              </div>
            </label>

            <label>
              <span>Site</span>
              <select bind:value={form.parkingLocation} required>
                {#each parkingLocations as location}
                  <option value={location}>{location}</option>
                {/each}
              </select>
            </label>
          </div>
        </div>

        <footer class="modal-actions">
          {#if mode === 'edit' && typeof form.index === 'number'}
            <div class="delete-zone">
              <button
                type="button"
                class={confirmingDelete ? 'danger confirming' : 'danger'}
                on:click={handleDeleteClick}
              >
                {confirmingDelete ? 'Confirm Delete?' : 'Delete'}
              </button>
            </div>
          {/if}
          <div class="save-cancel">
            <button type="button" on:click={handleClose}>Cancel</button>
            {#if mode === 'edit'}
              <button
                type="button"
                class="book-again"
                data-testid="book-again-btn"
                on:click={handleBookAgain}
                title="Pre-fill a new reservation with this guest's details"
              >Book Again</button>
            {/if}
            <button type="submit" class="primary">Save</button>
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
    width: min(52rem, 100%);
    max-height: min(90vh, 52rem);
    overflow-y: auto;
    background: white;
    border-radius: 14px;
    border: 1px solid #d7dce4;
    box-shadow: 0 24px 60px rgba(12, 24, 46, 0.18);
    padding: 1rem;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .modal-header-text {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    flex: 1;
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .meta {
    margin: 0;
    color: #455566;
    font-size: 0.85rem;
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

  .form-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .column-left,
  .column-right {
    display: grid;
    gap: 0.8rem;
    align-content: start;
  }

  .date-row {
    display: flex;
    align-items: end;
    gap: 0.5rem;
  }

  .date-label {
    flex: 1;
    min-width: 0;
  }

  .nights-badge {
    font-size: 0.82rem;
    font-weight: 700;
    color: #0c5fdb;
    padding: 0.35rem 0.55rem;
    background: #e8f0fe;
    border-radius: 6px;
    white-space: nowrap;
    align-self: end;
    margin-bottom: 0.15rem;
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

  /* Status select */
  .status-select-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator {
    width: 14px;
    height: 14px;
    min-width: 14px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-select-wrapper select {
    flex: 1;
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

  button.book-again {
    background: #f0f6ff;
    border-color: #c0d4f0;
    color: #1a4a8a;
  }

  button.book-again:hover {
    background: #e0eeff;
    border-color: #a0c0e8;
  }

  @media (max-width: 640px) {
    .form-columns {
      grid-template-columns: 1fr;
    }

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
