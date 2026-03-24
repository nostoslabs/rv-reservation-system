<script lang="ts">
  import { onMount } from 'svelte';
  import CustomerModal from '$lib/components/CustomerModal.svelte';
  import MergePreviewModal from '$lib/components/MergePreviewModal.svelte';
  import { customerStore } from '$lib/customer-state';
  import { rvReservationStore } from '$lib/state';
  import { siteSettingsStore } from '$lib/site-settings';
  import { formatReservationDetail } from '$lib/date';
  import { normalizeName, normalizePhoneNumber } from '$lib/domain/customers';
  import type { Customer, CustomerFormValues } from '$lib/domain/customers';
  import type { Reservation } from '$lib/types';
  import { deleteCustomerWithUndo, updateCustomerWithUndo } from '$lib/app/undoable-actions';

  let searchQuery = '';
  let sortBy: 'name' | 'lastVisit' | 'reservations' = 'name';

  // Select mode state
  let selectMode = false;
  let selectedIds: Set<string> = new Set();

  function enterSelectMode(): void {
    selectMode = true;
    selectedIds = new Set();
  }

  function exitSelectMode(): void {
    selectMode = false;
    selectedIds = new Set();
  }

  function toggleSelection(id: string): void {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds = next;
  }

  function toggleSelectAll(): void {
    if (selectedIds.size === filteredCustomers.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filteredCustomers.map((c) => c.id));
    }
  }

  function handleRowClick(customer: Customer): void {
    if (selectMode) {
      toggleSelection(customer.id);
    } else {
      openEditModal(customer);
    }
  }

  // Modal state
  let modalOpen = false;
  let modalMode: 'create' | 'edit' = 'create';
  let modalErrors: string[] = [];
  let modalDraft: CustomerFormValues = { name: '', phone: '', rvType: '', email: '', notes: '' };

  // Toast
  let toastMessage = '';
  let toastVisible = false;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string): void {
    toastMessage = message;
    toastVisible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible = false;
      toastTimer = null;
    }, 3000);
  }

  // Customer reservation history helpers
  function getCustomerReservations(customer: Customer): Reservation[] {
    const reservations = $rvReservationStore.reservations;
    return reservations.filter((r) => {
      if (r.customerId && r.customerId === customer.id) return true;
      // Fallback: match by normalized name + phone for legacy reservations
      const rName = normalizeName(r.name).toLowerCase();
      const cName = normalizeName(customer.name).toLowerCase();
      const rPhone = normalizePhoneNumber(r.phoneNumber).toLowerCase();
      const cPhone = normalizePhoneNumber(customer.phone).toLowerCase();
      return rName === cName && cPhone && rPhone === cPhone;
    });
  }

  function getLastVisit(customer: Customer): string | null {
    const res = getCustomerReservations(customer);
    if (res.length === 0) return null;
    return res.reduce((latest, r) =>
      r.startDate > latest ? r.startDate : latest, res[0].startDate
    );
  }

  $: filteredCustomers = (() => {
    let list = [...$customerStore];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.rvType.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'reservations') {
        return getCustomerReservations(b).length - getCustomerReservations(a).length;
      }
      if (sortBy === 'lastVisit') {
        const aLast = getLastVisit(a) ?? '';
        const bLast = getLastVisit(b) ?? '';
        return bLast.localeCompare(aLast);
      }
      return 0;
    });

    return list;
  })();

  function openCreateModal(): void {
    modalMode = 'create';
    modalDraft = { name: '', phone: '', rvType: '', email: '', notes: '' };
    modalErrors = [];
    modalOpen = true;
  }

  function openEditModal(customer: Customer): void {
    modalMode = 'edit';
    modalDraft = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      rvType: customer.rvType,
      email: customer.email,
      notes: customer.notes
    };
    modalErrors = [];
    modalOpen = true;
  }

  async function handleModalSave(event: CustomEvent<CustomerFormValues>): Promise<void> {
    const form = event.detail;
    const result = modalMode === 'create'
      ? await customerStore.create(form)
      : await updateCustomerWithUndo(form);

    if (!result.ok) {
      modalErrors = result.errors ?? ['An error occurred.'];
      return;
    }

    modalOpen = false;
    showToast(modalMode === 'create' ? 'Customer added' : 'Customer updated');
  }

  async function handleModalDelete(event: CustomEvent<{ id: string }>): Promise<void> {
    const result = await deleteCustomerWithUndo(event.detail.id);
    if (!result.ok) {
      modalErrors = result.errors ?? ['An error occurred.'];
      return;
    }

    modalOpen = false;
    showToast('Customer deleted');
  }

  function closeModal(): void {
    modalOpen = false;
    modalErrors = [];
  }

  let mergePreviewOpen = false;
  let mergePreviewCustomers: Customer[] = [];

  function openMergePreview(): void {
    mergePreviewCustomers = $customerStore.filter((c) => selectedIds.has(c.id));
    mergePreviewOpen = true;
  }

  async function handleMergeConfirm(event: CustomEvent<{ overrides: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes'>> }>): Promise<void> {
    const ids = mergePreviewCustomers.map((c) => c.id);
    const result = await customerStore.mergeCustomers(ids, event.detail.overrides);
    mergePreviewOpen = false;
    if (result.ok) {
      exitSelectMode();
      showToast(`Merged ${result.mergedCount} customers`);
    } else {
      showToast(result.errors[0] ?? 'Merge failed');
    }
  }

  function handleMergeCancel(): void {
    mergePreviewOpen = false;
  }

  onMount(() => {
    customerStore.hydrate();
    rvReservationStore.hydrate();
    siteSettingsStore.hydrate();
  });
</script>

<svelte:head>
  <title>Customers - {$siteSettingsStore.siteName}</title>
</svelte:head>

<div class="page-shell">
  <header class="toolbar">
    <a href="/" class="back-link" aria-label="Back to schedule" data-testid="back-to-schedule">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="20" height="20">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="toolbar-title">Customers</h1>

    <div class="toolbar-right">
      {#if selectMode}
        <button type="button" class="add-btn" on:click={exitSelectMode} data-testid="cancel-select-btn">
          Cancel
        </button>
        <button
          type="button"
          class="add-btn primary"
          disabled={selectedIds.size < 2}
          on:click={openMergePreview}
          data-testid="merge-selected-btn"
        >
          Merge Selected ({selectedIds.size})
        </button>
      {:else}
        <div class="search-input-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="16" height="16">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
          <input
            type="search"
            class="search-input"
            placeholder="Search customers..."
            bind:value={searchQuery}
            aria-label="Search customers"
            data-testid="customer-search-input"
          />
        </div>

        <select class="sort-select" bind:value={sortBy} aria-label="Sort customers by" data-testid="customer-sort-select">
          <option value="name">Sort: Name</option>
          <option value="lastVisit">Sort: Last Visit</option>
          <option value="reservations">Sort: Reservations</option>
        </select>

        <button type="button" class="add-btn" on:click={enterSelectMode} data-testid="select-mode-btn">
          Select
        </button>

        <button type="button" class="add-btn primary" on:click={openCreateModal} data-testid="add-customer-btn">
          + Add Customer
        </button>
      {/if}
    </div>
  </header>

  {#if $customerStore.length === 0 && !searchQuery.trim()}
    <div class="empty-state" data-testid="customer-empty-state">
      <p><strong>No customers yet.</strong></p>
      <p>
        Customers are created automatically when you save reservations, or you can
        <button type="button" class="inline-action" on:click={openCreateModal}>add one manually</button>.
        You can also import customers from a CSV file on the
        <a href="/admin">settings page</a>.
      </p>
    </div>
  {:else}
    <div class="customer-table-wrap">
      <table class="customer-table" data-testid="customer-table">
        <thead>
          <tr>
            {#if selectMode}
              <th class="col-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0}
                  on:change={toggleSelectAll}
                  aria-label="Select all customers"
                  data-testid="select-all-checkbox"
                />
              </th>
            {/if}
            <th>Name</th>
            <th>Phone</th>
            <th class="col-rv-type">RV Type</th>
            <th>Email</th>
            <th class="col-count">Reservations</th>
            <th class="col-date">Last Visit</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredCustomers as customer (customer.id)}
            {@const resCount = getCustomerReservations(customer).length}
            {@const lastVisit = getLastVisit(customer)}
            <tr
              class="customer-row"
              class:selected={selectMode && selectedIds.has(customer.id)}
              on:click={() => handleRowClick(customer)}
              data-testid="customer-row"
            >
              {#if selectMode}
                <td class="col-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(customer.id)}
                    on:click|stopPropagation={() => toggleSelection(customer.id)}
                    data-testid="customer-checkbox"
                  />
                </td>
              {/if}
              <td class="customer-name">{customer.name}</td>
              <td>{customer.phone || '—'}</td>
              <td class="col-rv-type">{customer.rvType || '—'}</td>
              <td>{customer.email || '—'}</td>
              <td class="col-count">{resCount}</td>
              <td class="col-date">{lastVisit ? formatReservationDetail(lastVisit) : '—'}</td>
            </tr>
          {:else}
            <tr>
              <td colspan={selectMode ? 7 : 6} class="no-results">No customers match your search.</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if toastVisible}
  <div class="toast" role="status" aria-live="polite">{toastMessage}</div>
{/if}

<CustomerModal
  open={modalOpen}
  mode={modalMode}
  draft={modalDraft}
  errors={modalErrors}
  on:save={handleModalSave}
  on:cancel={closeModal}
  on:delete={handleModalDelete}
/>

<MergePreviewModal
  open={mergePreviewOpen}
  customers={mergePreviewCustomers}
  on:confirm={handleMergeConfirm}
  on:cancel={handleMergeCancel}
/>

<style>
  .page-shell {
    padding: 0.5rem 1rem;
    display: grid;
    gap: 0.75rem;
    max-width: 72rem;
    margin: 0 auto;
  }

  .toolbar {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 0.4rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    backdrop-filter: blur(6px);
    flex-wrap: wrap;
    min-height: 48px;
  }

  .toolbar-title {
    margin: 0;
    font-size: 1.1rem;
    white-space: nowrap;
  }

  .toolbar-right {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-left: auto;
    flex-wrap: wrap;
  }

  .back-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid #d9e1ec;
    background: #f6f9fd;
    color: #5c6c80;
    text-decoration: none;
    flex-shrink: 0;
  }

  .back-link:hover {
    color: #0a63e0;
    border-color: #0a63e0;
    background: #edf3fd;
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
    min-width: 12rem;
    border-radius: 10px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    padding: 0.6rem 0.75rem 0.6rem 2rem;
    font-size: 0.9rem;
    color: #1c2e45;
    min-height: 44px;
    font: inherit;
  }

  .search-input::placeholder {
    color: #8a9bb2;
  }

  .search-input:focus {
    background: white;
    border-color: #0a63e0;
  }

  .sort-select {
    border-radius: 10px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    min-height: 44px;
    font: inherit;
    color: #223349;
  }

  .add-btn {
    border-radius: 10px;
    border: 1px solid #c1cada;
    padding: 0.6rem 0.85rem;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    white-space: nowrap;
  }

  .add-btn.primary {
    background: #0c5fdb;
    border-color: #0c5fdb;
    color: white;
  }

  .add-btn.primary:hover {
    background: #0757c8;
  }

  /* Empty state */
  .empty-state {
    background: #f0f6ff;
    border: 1px dashed #b0c4de;
    border-radius: 12px;
    padding: 2rem 1.5rem;
    text-align: center;
    color: #3d5a78;
    font-size: 0.95rem;
  }

  .empty-state p {
    margin: 0 0 0.5rem;
    line-height: 1.6;
  }

  .empty-state p:last-child {
    margin-bottom: 0;
  }

  .inline-action {
    background: none;
    border: none;
    color: #0c5fdb;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    text-decoration: underline;
    min-height: auto;
  }

  .empty-state a {
    color: #0c5fdb;
    font-weight: 600;
  }

  /* Table */
  .customer-table-wrap {
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 14px;
    box-shadow: var(--shadow);
    overflow: auto;
  }

  .customer-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .customer-table thead {
    background: #eef3fb;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .customer-table th {
    text-align: left;
    padding: 0.65rem 0.75rem;
    font-weight: 700;
    color: #31465f;
    border-bottom: 1px solid #d6dfed;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .customer-table td {
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid #edf1f7;
    color: #263444;
  }

  .customer-row {
    cursor: pointer;
    transition: background 0.1s;
  }

  .customer-row:hover {
    background: #f0f6ff;
  }

  .customer-row.selected {
    background: #e8f0fe;
  }

  .col-checkbox {
    width: 2.5rem;
    text-align: center;
  }

  .col-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .customer-name {
    font-weight: 600;
    color: #1b304a;
  }

  .col-count {
    text-align: center;
    width: 6rem;
  }

  .col-date {
    width: 8rem;
    white-space: nowrap;
  }

  .no-results {
    text-align: center;
    color: #6b7d93;
    padding: 1.5rem 0.75rem;
  }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    background: #1b304a;
    color: white;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(15, 28, 47, 0.2);
    z-index: 200;
    animation: toast-in 0.25s ease-out;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .col-rv-type {
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .col-date, .col-count, .col-rv-type {
      display: none;
    }
  }
</style>
