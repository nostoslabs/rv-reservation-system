<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { resolveCustomerMerge } from '$lib/domain/customers';
  import type { Customer } from '$lib/domain/customers';

  export let open = false;
  export let customers: Customer[] = [];

  const dispatch = createEventDispatcher<{
    confirm: { overrides: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes'>> };
    cancel: void;
  }>();

  type FieldKey = 'name' | 'phone' | 'email' | 'notes';

  let overrides: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes'>> = {};

  $: if (open && customers.length >= 2) {
    overrides = {};
  }

  $: resolution = (open && customers.length >= 2)
    ? resolveCustomerMerge(customers, new Date().toISOString())
    : null;

  $: mergedPreview = resolution ? {
    ...resolution.winner,
    ...overrides
  } : null;

  function getUniqueValues(field: FieldKey): string[] {
    const seen = new Set<string>();
    const values: string[] = [];
    for (const c of customers) {
      const val = c[field].trim();
      if (val && !seen.has(val)) {
        seen.add(val);
        values.push(val);
      }
    }
    return values;
  }

  function getSelectedValue(field: FieldKey): string {
    if (overrides[field] !== undefined) return overrides[field]!;
    return resolution?.winner[field] ?? '';
  }

  function selectValue(field: FieldKey, value: string): void {
    if (resolution && value === resolution.winner[field]) {
      const next = { ...overrides };
      delete next[field];
      overrides = next;
    } else {
      overrides = { ...overrides, [field]: value };
    }
  }

  function handleConfirm(): void {
    dispatch('confirm', { overrides });
  }

  function handleCancel(): void {
    dispatch('cancel');
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (event.currentTarget === event.target) {
      handleCancel();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      handleCancel();
    }
  }

  const fieldLabels: Record<FieldKey, string> = {
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    notes: 'Notes'
  };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && resolution}
  <div class="modal-backdrop" role="presentation" on:click={handleOverlayClick}>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="merge-modal-title" data-testid="merge-preview-modal">
      <header class="modal-header">
        <h2 id="merge-modal-title">Merge {customers.length} Customers</h2>
        <button
          type="button"
          class="close-button"
          aria-label="Close modal"
          on:click={handleCancel}
        >&times;</button>
      </header>

      <div class="merge-fields">
        {#each (['name', 'phone', 'email', 'notes'] as FieldKey[]) as field}
          {@const values = getUniqueValues(field)}
          {@const selected = getSelectedValue(field)}
          <div class="merge-field" data-testid="merge-field-{field}">
            <span class="field-label">{fieldLabels[field]}</span>
            {#if values.length === 0}
              <span class="field-empty">None</span>
            {:else if values.length === 1}
              <span class="field-single">{values[0]}</span>
            {:else}
              <div class="field-options">
                {#each values as value}
                  <label class="radio-option" class:checked={selected === value}>
                    <input
                      type="radio"
                      name="merge-{field}"
                      checked={selected === value}
                      on:change={() => selectValue(field, value)}
                    />
                    <span class="radio-label">{field === 'notes' ? value.slice(0, 80) + (value.length > 80 ? '...' : '') : value}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if mergedPreview}
        <div class="preview-card">
          <h3>Merged Result</h3>
          <div class="preview-row"><strong>Name:</strong> {mergedPreview.name || '—'}</div>
          <div class="preview-row"><strong>Phone:</strong> {mergedPreview.phone || '—'}</div>
          <div class="preview-row"><strong>Email:</strong> {mergedPreview.email || '—'}</div>
          <div class="preview-row"><strong>Notes:</strong> {mergedPreview.notes || '—'}</div>
        </div>
      {/if}

      <footer class="modal-actions">
        <button type="button" on:click={handleCancel} data-testid="merge-cancel-btn">Cancel</button>
        <button type="button" class="primary" on:click={handleConfirm} data-testid="merge-confirm-btn">Merge</button>
      </footer>
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
    width: min(36rem, 100%);
    max-height: 90vh;
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

  .merge-fields {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .merge-field {
    display: grid;
    gap: 0.3rem;
  }

  .field-label {
    font-weight: 700;
    font-size: 0.85rem;
    color: #31465f;
  }

  .field-empty {
    color: #8a9bb2;
    font-style: italic;
    font-size: 0.9rem;
  }

  .field-single {
    font-size: 0.9rem;
    color: #263444;
  }

  .field-options {
    display: grid;
    gap: 0.3rem;
  }

  .radio-option {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    border-radius: 8px;
    border: 1px solid #e0e6ee;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: normal;
    transition: background 0.1s, border-color 0.1s;
  }

  .radio-option:hover {
    background: #f5f8fc;
  }

  .radio-option.checked {
    background: #edf3fd;
    border-color: #0a63e0;
  }

  .radio-option input[type="radio"] {
    margin-top: 0.15rem;
    flex-shrink: 0;
  }

  .radio-label {
    word-break: break-word;
  }

  .preview-card {
    background: #f6f9fd;
    border: 1px solid #d9e1ec;
    border-radius: 10px;
    padding: 0.75rem;
    margin-bottom: 1rem;
  }

  .preview-card h3 {
    margin: 0 0 0.4rem;
    font-size: 0.9rem;
    color: #31465f;
  }

  .preview-row {
    font-size: 0.85rem;
    color: #263444;
    line-height: 1.6;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
  }

  button {
    border-radius: 10px;
    border: 1px solid #c1cada;
    background: #f6f8fb;
    color: #203045;
    padding: 0.6rem 0.85rem;
    cursor: pointer;
    font: inherit;
    min-height: 44px;
  }

  button.primary {
    background: #0c5fdb;
    border-color: #0c5fdb;
    color: white;
    font-weight: 600;
  }

  button.primary:hover {
    background: #0757c8;
  }
</style>
