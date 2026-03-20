<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { DEFAULT_SITE_NAME } from '$lib/storage';
  import { siteSettingsStore } from '$lib/site-settings';
  import { customerStore } from '$lib/customer-state';
  import ParkingLocationsPanel from '$lib/components/ParkingLocationsPanel.svelte';
  import { rvReservationStore } from '$lib/state';
  import { createBackup, validateBackup, type AppBackup } from '$lib/domain/backup';
  import { getAppServices } from '$lib/app/composition';

  const SITE_NAME_MAX_LENGTH = 80;

  let siteNameDraft = DEFAULT_SITE_NAME;
  let errorMessage = '';
  let successMessage = '';

  // CSV import state
  let csvFile: File | null = null;
  let csvImportResult: { imported: number; skipped: number; errors: string[] } | null = null;
  let csvImporting = false;
  let csvErrorsExpanded = false;

  // Backup import state
  let backupImporting = false;

  let locationPanelError = '';

  $: reservationCountsByLocation = $rvReservationStore.reservations.reduce<Record<string, number>>(
    (counts, r) => {
      counts[r.parkingLocation] = (counts[r.parkingLocation] ?? 0) + 1;
      return counts;
    },
    Object.fromEntries($rvReservationStore.parkingLocations.map((loc) => [loc, 0]))
  );

  onMount(() => {
    siteSettingsStore.hydrate();
    customerStore.hydrate();
    rvReservationStore.hydrate();
    siteNameDraft = $siteSettingsStore.siteName;
  });

  function handleCsvFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    csvFile = input.files?.[0] ?? null;
    csvImportResult = null;
    csvErrorsExpanded = false;
  }

  async function handleCsvImport(): Promise<void> {
    if (!csvFile) return;
    csvImporting = true;
    clearMessages();

    try {
      const text = await csvFile.text();
      csvImportResult = await customerStore.importCsv(text);
      csvErrorsExpanded = false;
    } catch {
      csvImportResult = { imported: 0, skipped: 0, errors: ['Failed to read file.'] };
    } finally {
      csvImporting = false;
    }
  }

  function resetCsvImport(): void {
    csvFile = null;
    csvImportResult = null;
    csvErrorsExpanded = false;
  }

  function clearMessages(): void {
    errorMessage = '';
    successMessage = '';
  }

  async function handleSaveSiteName(): Promise<void> {
    clearMessages();
    const nextSiteName = siteNameDraft.trim();
    if (!nextSiteName) {
      errorMessage = 'Site name is required.';
      return;
    }

    const saved = await siteSettingsStore.setSiteName(nextSiteName);
    siteNameDraft = saved.siteName;
    successMessage = 'Site name updated.';
  }

  function applyLocationMutation(result: { ok: boolean; errors?: string[] }): void {
    if (result.ok) {
      locationPanelError = '';
      return;
    }
    locationPanelError = result.errors?.[0] ?? 'Unable to update sites.';
  }

  async function handleAddLocation(event: CustomEvent<{ name: string }>): Promise<void> {
    applyLocationMutation(await rvReservationStore.addParkingLocation(event.detail.name));
  }

  async function handleRenameLocation(event: CustomEvent<{ oldName: string; newName: string }>): Promise<void> {
    applyLocationMutation(await rvReservationStore.renameParkingLocation(event.detail.oldName, event.detail.newName));
  }

  async function handleDeleteLocation(event: CustomEvent<{ name: string }>): Promise<void> {
    applyLocationMutation(await rvReservationStore.deleteParkingLocation(event.detail.name));
  }

  async function handleReorderLocations(event: CustomEvent<{ orderedNames: string[] }>): Promise<void> {
    applyLocationMutation(await rvReservationStore.reorderParkingLocations(event.detail.orderedNames));
  }

  const JSON_FILTERS = [{ name: 'JSON', extensions: ['json'] }];

  async function handleExportBackup(): Promise<void> {
    clearMessages();

    const state = get(rvReservationStore);
    const settings = get(siteSettingsStore);
    const customers = customerStore.getAll();

    const backup = createBackup(
      state.reservations,
      state.parkingLocations,
      settings,
      customers
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `rv-backup-${dateStr}.json`;
    const content = JSON.stringify(backup, null, 2);

    const { desktop } = getAppServices();
    const saved = await desktop.saveFile(filename, content, JSON_FILTERS);
    if (saved) {
      successMessage = 'Backup exported successfully.';
    }
  }

  async function handleBackupImport(): Promise<void> {
    backupImporting = true;
    clearMessages();

    try {
      const { desktop } = getAppServices();
      const text = await desktop.openFile(JSON_FILTERS);
      if (!text) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        errorMessage = 'Invalid JSON file.';
        return;
      }

      const validation = validateBackup(parsed);
      if (!validation.valid) {
        errorMessage = 'Invalid backup file: ' + validation.errors.join('; ');
        return;
      }

      const confirmed = confirm('This will replace all current data with the backup. Continue?');
      if (!confirmed) return;

      const backup = parsed as AppBackup;

      // Import reservation data (reservations + parking locations)
      const currentState = get(rvReservationStore);
      const maxIndex = backup.data.reservations.reduce(
        (max, r) => Math.max(max, r.index),
        0
      );
      await rvReservationStore.importData({
        version: currentState.version,
        reservations: backup.data.reservations,
        parkingLocations: backup.data.parkingLocations,
        nextReservationIndex: Math.max(maxIndex + 1, 1),
        lastSavedAt: currentState.lastSavedAt
      });

      // Import customers
      await customerStore.replaceAll(backup.data.customers);

      // Import site settings
      if (backup.data.siteSettings) {
        await siteSettingsStore.setSiteName(backup.data.siteSettings.siteName);
        if (typeof backup.data.siteSettings.compactView === 'boolean') {
          await siteSettingsStore.setCompactView(backup.data.siteSettings.compactView);
        }
        siteNameDraft = backup.data.siteSettings.siteName;
      }

      successMessage = `Backup restored successfully (${backup.data.reservations.length} reservations, ${backup.data.customers.length} customers).`;
    } catch {
      errorMessage = 'Failed to import backup file.';
    } finally {
      backupImporting = false;
    }
  }
</script>

<svelte:head>
  <title>Settings | {$siteSettingsStore.siteName}</title>
  <meta name="description" content="Park settings for {$siteSettingsStore.siteName}." />
</svelte:head>

<div class="admin-shell">
  <header class="admin-header">
    <a href="/" class="back-link" data-testid="back-to-schedule">&larr; Back to Schedule</a>
    <h1>Park Settings</h1>
    <p>
      Manage your park name, sites, and customer data.
    </p>
  </header>

  {#if errorMessage}
    <p class="message error" role="alert">{errorMessage}</p>
  {/if}
  {#if successMessage}
    <p class="message success" aria-live="polite">{successMessage}</p>
  {/if}

  <section class="panel">
    <h2>Site Name</h2>
    <p>This value appears in the main page header and persists locally.</p>
    <form class="stack" on:submit|preventDefault={handleSaveSiteName}>
      <label>
        <span>Site Name</span>
        <input bind:value={siteNameDraft} type="text" maxlength={SITE_NAME_MAX_LENGTH} required />
      </label>
      <div class="meta">{siteNameDraft.trim().length}/{SITE_NAME_MAX_LENGTH}</div>
      <button type="submit" class="primary">Save Site Name</button>
    </form>
  </section>

  <section class="panel" data-testid="csv-import-panel">
    <h2>Import Customers</h2>
    <p>Upload a CSV file with columns: <strong>name</strong>, phone, email, notes. Only name is required.</p>

    {#if csvImportResult}
      <div class="import-result" data-testid="csv-import-result">
        <p class="import-summary">
          Imported <strong>{csvImportResult.imported}</strong> customer{csvImportResult.imported !== 1 ? 's' : ''},
          skipped <strong>{csvImportResult.skipped}</strong> duplicate{csvImportResult.skipped !== 1 ? 's' : ''}{csvImportResult.errors.length > 0 ? `, ${csvImportResult.errors.length} error${csvImportResult.errors.length !== 1 ? 's' : ''}` : ''}.
        </p>
        {#if csvImportResult.errors.length > 0}
          <button type="button" class="toggle-errors" on:click={() => csvErrorsExpanded = !csvErrorsExpanded}>
            {csvErrorsExpanded ? 'Hide' : 'Show'} errors
          </button>
          {#if csvErrorsExpanded}
            <ul class="error-list">
              {#each csvImportResult.errors as err}
                <li>{err}</li>
              {/each}
            </ul>
          {/if}
        {/if}
        <button type="button" on:click={resetCsvImport}>Import Another</button>
      </div>
    {:else}
      <div class="stack">
        <label>
          <span>CSV File</span>
          <input type="file" accept=".csv" on:change={handleCsvFileChange} data-testid="csv-file-input" />
        </label>
        <button
          type="button"
          class="primary"
          disabled={!csvFile || csvImporting}
          on:click={handleCsvImport}
          data-testid="csv-import-btn"
        >
          {csvImporting ? 'Importing...' : 'Import'}
        </button>
      </div>
    {/if}
  </section>

  <section class="panel" data-testid="backup-panel">
    <h2>Backup &amp; Restore</h2>
    <p>Export all app data as JSON, or restore from a previous backup.</p>

    <div class="stack">
      <button
        type="button"
        class="primary"
        on:click={handleExportBackup}
        data-testid="backup-export-btn"
      >
        Export Backup
      </button>

      <button
        type="button"
        disabled={backupImporting}
        on:click={handleBackupImport}
        data-testid="backup-import-btn"
      >
        {backupImporting ? 'Restoring...' : 'Restore Backup'}
      </button>
    </div>
  </section>

  <div data-testid="sites-management">
    <ParkingLocationsPanel
      locations={$rvReservationStore.parkingLocations}
      reservationCounts={reservationCountsByLocation}
      errorMessage={locationPanelError}
      on:add={handleAddLocation}
      on:rename={handleRenameLocation}
      on:remove={handleDeleteLocation}
      on:reorder={handleReorderLocations}
      on:clearerror={() => (locationPanelError = '')}
    />
  </div>
</div>

<style>
  .admin-shell {
    max-width: 46rem;
    margin: 0 auto;
    padding: 1rem;
    display: grid;
    gap: 0.9rem;
  }

  .admin-header,
  .panel {
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid #d6dfeb;
    border-radius: 16px;
    box-shadow: var(--shadow);
    padding: 1rem;
  }

  .back-link {
    display: inline-block;
    margin: 0 0 0.3rem;
    color: #0c5fdb;
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  h1,
  h2 {
    margin: 0;
  }

  .admin-header h1 {
    margin-top: 0.2rem;
  }

  .admin-header p:last-child {
    margin: 0.45rem 0 0;
    color: #5c6c80;
  }

  .panel p {
    margin: 0.4rem 0 0.7rem;
    color: #5b6a7e;
  }

  .stack {
    display: grid;
    gap: 0.7rem;
  }

  label {
    display: grid;
    gap: 0.35rem;
    font-weight: 600;
    color: #28384d;
  }

  input,
  button {
    font: inherit;
  }

  input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #c8d1de;
    padding: 0.55rem 0.65rem;
    background: white;
    color: #102033;
  }

  button {
    width: fit-content;
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

  .meta {
    color: #5c6b7e;
    font-size: 0.85rem;
  }

  .message {
    margin: 0;
    border-radius: 12px;
    padding: 0.65rem 0.75rem;
    border: 1px solid;
  }

  .message.error {
    background: #fff2f2;
    border-color: #f2b4b4;
    color: #842828;
  }

  .message.success {
    background: #effaf2;
    border-color: #b8e0bf;
    color: #205d2a;
  }

  .import-result {
    display: grid;
    gap: 0.5rem;
  }

  .import-summary {
    margin: 0;
    color: #263444;
  }

  .toggle-errors {
    font-size: 0.85rem;
    color: #0c5fdb;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    width: fit-content;
  }

  .error-list {
    margin: 0;
    padding-left: 1.2rem;
    color: #842828;
    font-size: 0.85rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input[type="file"] {
    padding: 0.4rem;
    border: 1px dashed #c8d1de;
    border-radius: 10px;
    background: #fafbfd;
  }

</style>
