<script lang="ts">
  import { onMount } from 'svelte';
  import { DEFAULT_SITE_NAME } from '$lib/storage';
  import { siteSettingsStore } from '$lib/site-settings';
  import { customerStore } from '$lib/customer-state';

  const SITE_NAME_MAX_LENGTH = 80;
  const PASSCODE_MAX_LENGTH = 64;

  let unlocked = false;
  let unlockPasscode = '';
  let firstPasscode = '';
  let siteNameDraft = DEFAULT_SITE_NAME;
  let newPasscodeDraft = '';
  let hasPasscode = false;
  let errorMessage = '';
  let successMessage = '';

  // CSV import state
  let csvFile: File | null = null;
  let csvImportResult: { imported: number; skipped: number; errors: string[] } | null = null;
  let csvImporting = false;
  let csvErrorsExpanded = false;

  $: hasPasscode = $siteSettingsStore.adminPasscode.length > 0;

  onMount(() => {
    siteSettingsStore.hydrate();
    customerStore.hydrate();
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
      csvImportResult = customerStore.importCsv(text);
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

  function handleUnlock(): void {
    clearMessages();
    if (!hasPasscode) {
      unlocked = true;
      return;
    }

    if (unlockPasscode.trim() !== $siteSettingsStore.adminPasscode) {
      errorMessage = 'Incorrect passcode.';
      return;
    }

    unlocked = true;
    unlockPasscode = '';
  }

  function handleSetInitialPasscode(): void {
    clearMessages();
    const passcode = firstPasscode.trim();
    if (!passcode) {
      errorMessage = 'Passcode is required.';
      return;
    }

    siteSettingsStore.setAdminPasscode(passcode);
    firstPasscode = '';
    unlocked = true;
    successMessage = 'Admin passcode saved.';
  }

  function handleSaveSiteName(): void {
    clearMessages();
    const nextSiteName = siteNameDraft.trim();
    if (!nextSiteName) {
      errorMessage = 'Site name is required.';
      return;
    }

    const saved = siteSettingsStore.setSiteName(nextSiteName);
    siteNameDraft = saved.siteName;
    successMessage = 'Site name updated.';
  }

  function handleChangePasscode(): void {
    clearMessages();
    const nextPasscode = newPasscodeDraft.trim();
    if (!nextPasscode) {
      errorMessage = 'New passcode is required.';
      return;
    }

    siteSettingsStore.setAdminPasscode(nextPasscode);
    newPasscodeDraft = '';
    successMessage = 'Passcode updated.';
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
      Manage your park name and admin passcode. Protected settings require a passcode.
    </p>
  </header>

  {#if errorMessage}
    <p class="message error" role="alert">{errorMessage}</p>
  {/if}
  {#if successMessage}
    <p class="message success" aria-live="polite">{successMessage}</p>
  {/if}

  {#if !hasPasscode}
    <section class="panel">
      <h2>Set Admin Passcode</h2>
      <p>No admin passcode is set yet. Create one to protect this page on future visits.</p>
      <form class="stack" on:submit|preventDefault={handleSetInitialPasscode}>
        <label>
          <span>Passcode</span>
          <input bind:value={firstPasscode} type="password" maxlength={PASSCODE_MAX_LENGTH} required />
        </label>
        <button type="submit" class="primary">Save Passcode</button>
      </form>
    </section>
  {:else if !unlocked}
    <section class="panel">
      <h2>Enter Passcode</h2>
      <form class="stack" on:submit|preventDefault={handleUnlock}>
        <label>
          <span>Passcode</span>
          <input bind:value={unlockPasscode} type="password" maxlength={PASSCODE_MAX_LENGTH} required />
        </label>
        <button type="submit" class="primary">Unlock</button>
      </form>
    </section>
  {/if}

  {#if unlocked}
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

    <section class="panel">
      <h2>Change Passcode</h2>
      <form class="stack" on:submit|preventDefault={handleChangePasscode}>
        <label>
          <span>New Passcode</span>
          <input bind:value={newPasscodeDraft} type="password" maxlength={PASSCODE_MAX_LENGTH} required />
        </label>
        <button type="submit">Update Passcode</button>
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
  {/if}
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
