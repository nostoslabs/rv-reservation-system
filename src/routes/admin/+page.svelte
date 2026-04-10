<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { get } from 'svelte/store';
  import { DEFAULT_SITE_NAME } from '$lib/storage';
  import { siteSettingsStore } from '$lib/site-settings';
  import { customerStore } from '$lib/customer-state';
  import ParkingLocationsPanel from '$lib/components/ParkingLocationsPanel.svelte';
  import { rvReservationStore } from '$lib/state';
  import { createBackup, generateBackupFilename, normalizeBackupForRestore, validateBackup, type AppBackup } from '$lib/domain/backup';
  import { restoreBackup, type RestoreStores } from '$lib/application/use-cases/restore-backup';
  import { getAppServices } from '$lib/app/composition';
  import { AUTO_BACKUP_INTERVALS, type AutoBackupIntervalMinutes } from '$lib/types';
  import type { UpdateChecker, UpdateState } from '$lib/app/update-checker';
  import { readable } from 'svelte/store';
  import { backupStatus } from '$lib/app/auto-backup';

  const SITE_NAME_MAX_LENGTH = 80;

  const INTERVAL_LABELS: Record<number, string> = {
    0: 'Off',
    5: 'Every 5 minutes',
    10: 'Every 10 minutes',
    30: 'Every 30 minutes',
    60: 'Every hour',
    120: 'Every 2 hours',
    240: 'Every 4 hours',
    480: 'Every 8 hours',
    1440: 'Every 24 hours'
  };

  let appVersion = '';
  let isDesktop = false;
  const updateChecker = getContext<UpdateChecker | undefined>('updateChecker');
  const noUpdateState: UpdateState = { checking: false, available: null, downloading: false, downloadProgress: 0, installed: false, error: null };
  const updateState = updateChecker?.state ?? readable(noUpdateState);

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

  // Beta updates confirmation
  let showBetaConfirm = false;

  $: reservationCountsByLocation = $rvReservationStore.reservations.reduce<Record<string, number>>(
    (counts, r) => {
      counts[r.parkingLocation] = (counts[r.parkingLocation] ?? 0) + 1;
      return counts;
    },
    Object.fromEntries($rvReservationStore.parkingLocations.map((loc) => [loc, 0]))
  );

  onMount(async () => {
    siteSettingsStore.hydrate();
    customerStore.hydrate();
    rvReservationStore.hydrate();
    siteNameDraft = $siteSettingsStore.siteName;

    const { desktop } = getAppServices();
    isDesktop = desktop.isDesktop;
    appVersion = (await desktop.getVersion()) ?? '';
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

    const result = await siteSettingsStore.setSiteName(nextSiteName);
    if (!result.ok) {
      errorMessage = result.errors?.[0] ?? 'Unable to update site name.';
      return;
    }
    if (!result.settings) {
      errorMessage = 'Unable to update site name.';
      return;
    }

    siteNameDraft = result.settings.siteName;
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
    const result = await rvReservationStore.renameParkingLocation(event.detail.oldName, event.detail.newName);
    applyLocationMutation(result);
    if (result.ok) {
      const colorResult = await siteSettingsStore.renameSiteColor(event.detail.oldName, event.detail.newName);
      if (!colorResult.ok) {
        locationPanelError = colorResult.errors?.[0] ?? 'Location renamed, but site color could not be updated.';
      }
    }
  }

  async function handleDeleteLocation(event: CustomEvent<{ name: string }>): Promise<void> {
    const result = await rvReservationStore.deleteParkingLocation(event.detail.name);
    applyLocationMutation(result);
    if (result.ok) {
      const colorResult = await siteSettingsStore.removeSiteColor(event.detail.name);
      if (!colorResult.ok) {
        console.error('Failed to remove site color:', colorResult.errors);
      }
    }
  }

  async function handleReorderLocations(event: CustomEvent<{ orderedNames: string[] }>): Promise<void> {
    applyLocationMutation(await rvReservationStore.reorderParkingLocations(event.detail.orderedNames));
  }

  async function handleColorChange(event: CustomEvent<{ name: string; color: string | null }>): Promise<void> {
    const result = await siteSettingsStore.setSiteColor(event.detail.name, event.detail.color);
    if (!result.ok) {
      locationPanelError = result.errors?.[0] ?? 'Failed to save site color.';
    }
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

    const filename = generateBackupFilename();
    const content = JSON.stringify(backup, null, 2);

    try {
      const { desktop } = getAppServices();
      const saved = await desktop.saveFile(filename, content, JSON_FILTERS);
      if (saved) {
        successMessage = 'Backup exported successfully.';
      }
    } catch (err) {
      console.error('Backup export failed:', err);
      errorMessage = `Export failed: ${err instanceof Error ? err.message : 'unknown error'}`;
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
      const restored = normalizeBackupForRestore(backup);

      const currentState = get(rvReservationStore);
      const maxIndex = restored.reservations.reduce((max, r) => Math.max(max, r.index), 0);

      const stores: RestoreStores = {
        getCustomers: () => customerStore.getAll(),
        getAppData: () => {
          const s = get(rvReservationStore);
          return { version: s.version, reservations: s.reservations, parkingLocations: s.parkingLocations, nextReservationIndex: s.nextReservationIndex, lastSavedAt: s.lastSavedAt };
        },
        getSettings: () => get(siteSettingsStore),
        replaceCustomers: (c) => customerStore.replaceAll(c),
        importAppData: (d) => rvReservationStore.importData(d),
        setSiteName: (n) => siteSettingsStore.setSiteName(n),
        setCompactView: (v) => siteSettingsStore.setCompactView(v)
      };

      const result = await restoreBackup({
        customers: restored.customers,
        reservations: restored.reservations,
        parkingLocations: restored.parkingLocations,
        nextReservationIndex: Math.max(maxIndex + 1, 1),
        version: currentState.version,
        lastSavedAt: currentState.lastSavedAt,
        siteSettings: restored.siteSettings
      }, stores);

      if (!result.ok) {
        errorMessage = result.error;
        return;
      }

      if (result.siteName) {
        siteNameDraft = result.siteName;
      }

      successMessage = `Backup restored successfully (${result.reservationCount} reservations, ${result.customerCount} customers).`;
    } catch (err) {
      console.error('Backup import failed:', err);
      errorMessage = `Import failed: ${err instanceof Error ? err.message : 'unknown error'}`;
    } finally {
      backupImporting = false;
    }
  }

  async function handlePickBackupDirectory(): Promise<void> {
    clearMessages();
    const { desktop } = getAppServices();
    const dir = await desktop.pickDirectory();
    if (!dir) return;

    // Validate the directory is writable by creating and removing a test file
    try {
      const separator = dir.endsWith('/') || dir.endsWith('\\') ? '' : '/';
      const testPath = `${dir}${separator}.rv-backup-test`;
      await desktop.writeFileToPath(testPath, 'test');
      // Cleanup is best-effort — if it fails, the tiny file is harmless
    } catch {
      errorMessage = 'Cannot write to that directory. Please choose a folder this app has permission to access.';
      return;
    }

    const result = await siteSettingsStore.setAutoBackupDirectory(dir);
    if (!result.ok) {
      errorMessage = result.errors?.[0] ?? 'Unable to set backup directory.';
    }
  }

  async function handleClearBackupDirectory(): Promise<void> {
    clearMessages();
    await siteSettingsStore.setAutoBackupDirectory(null);
    await siteSettingsStore.setAutoBackupInterval(0);
  }

  async function handleIntervalChange(event: Event): Promise<void> {
    clearMessages();
    const value = Number((event.target as HTMLSelectElement).value) as AutoBackupIntervalMinutes;
    const result = await siteSettingsStore.setAutoBackupInterval(value);
    if (!result.ok) {
      errorMessage = result.errors?.[0] ?? 'Unable to set backup interval.';
    }
  }

  function formatLastBackup(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return 'Never';
    }
  }

  function handleBetaToggle(): void {
    if ($siteSettingsStore.betaUpdates) {
      // Disabling — no confirmation needed
      siteSettingsStore.setBetaUpdates(false);
      updateChecker?.checkForUpdate(false);
    } else {
      // Enabling — show confirmation
      showBetaConfirm = true;
    }
  }

  async function confirmEnableBeta(): Promise<void> {
    showBetaConfirm = false;
    await siteSettingsStore.setBetaUpdates(true);
    updateChecker?.checkForUpdate(true);
  }

  function cancelBetaConfirm(): void {
    showBetaConfirm = false;
  }
</script>

<svelte:head>
  <title>Settings | {$siteSettingsStore.siteName}</title>
  <meta name="description" content="Park settings for {$siteSettingsStore.siteName}." />
</svelte:head>

<div class="page-shell">
  <header class="toolbar">
    <a href="/" class="back-link" aria-label="Back to schedule" data-testid="back-to-schedule">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="20" height="20">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="toolbar-title">Park Settings</h1>
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
    <p>Export all app data as JSON, or restore from a previous backup. To protect against data loss, save a backup to a USB drive or cloud folder. To recover on a new computer, install the app and use Restore Backup with your saved file.</p>

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

  {#if isDesktop}
    <section class="panel" data-testid="auto-backup-panel">
      <h2>Automatic Backup</h2>
      <p>Silently write backups to a folder on a schedule. For best protection, choose a folder that syncs to the cloud (e.g. iCloud, Google Drive, or Dropbox).</p>

      <div class="stack">
        <label>
          <span>Backup Folder</span>
          <div class="folder-row">
            <input
              type="text"
              readonly
              value={$siteSettingsStore.autoBackup?.directoryPath ?? ''}
              placeholder="No folder selected"
              data-testid="auto-backup-directory"
            />
            <button type="button" on:click={handlePickBackupDirectory} data-testid="auto-backup-pick-dir">
              Choose Folder
            </button>
            {#if $siteSettingsStore.autoBackup?.directoryPath}
              <button type="button" on:click={handleClearBackupDirectory} data-testid="auto-backup-clear-dir">
                Clear
              </button>
            {/if}
          </div>
        </label>

        <label>
          <span>Backup Interval</span>
          <select
            value={$siteSettingsStore.autoBackup?.intervalMinutes ?? 0}
            on:change={handleIntervalChange}
            disabled={!$siteSettingsStore.autoBackup?.directoryPath}
            data-testid="auto-backup-interval"
          >
            {#each AUTO_BACKUP_INTERVALS as interval}
              <option value={interval}>{INTERVAL_LABELS[interval]}</option>
            {/each}
          </select>
        </label>

        <div class="meta" data-testid="auto-backup-last">
          Last auto-backup: {formatLastBackup($siteSettingsStore.autoBackup?.lastBackupAt)}
        </div>

        {#if $backupStatus.lastError}
          <div class="backup-error" role="alert" data-testid="auto-backup-error">
            <strong>Backup failed</strong>
            <span>{$backupStatus.lastError}</span>
            {#if $backupStatus.consecutiveFailures > 1}
              <span class="failure-count">({$backupStatus.consecutiveFailures} consecutive failures)</span>
            {/if}
          </div>
        {/if}
      </div>
    </section>

    {#if updateChecker}
      <section class="panel" data-testid="updates-panel">
        <h2>Updates</h2>
        <p>Current version: {appVersion || 'unknown'}</p>

        <div class="stack">
          {#if $updateState.installed}
            <div class="update-status success" data-testid="update-installed">
              Update installed. Restart to apply.
            </div>
            <button type="button" class="primary" on:click={() => updateChecker.relaunch()} data-testid="update-restart-btn">
              Restart Now
            </button>
          {:else if $updateState.downloading}
            <div class="update-status" data-testid="update-downloading">
              Downloading update... {$updateState.downloadProgress}%
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {$updateState.downloadProgress}%"></div>
            </div>
          {:else if $updateState.available}
            <div class="update-status" data-testid="update-available">
              Update available: v{$updateState.available.version}
              {#if $updateState.available.version.includes('-beta')}
                <span class="beta-badge">Beta</span>
              {/if}
            </div>
            <button type="button" class="primary" on:click={() => updateChecker.downloadAndInstall()} data-testid="update-download-btn">
              Download &amp; Install
            </button>
          {:else if $updateState.checking}
            <div class="update-status" data-testid="update-checking">
              Checking for updates...
            </div>
          {:else if $updateState.error}
            <div class="update-status error" data-testid="update-error">
              {$updateState.error}
            </div>
            <button type="button" on:click={() => updateChecker.checkForUpdate($siteSettingsStore.betaUpdates)} data-testid="update-retry-btn">
              Retry
            </button>
          {:else}
            <div class="update-status" data-testid="update-up-to-date">
              You're up to date.
            </div>
            <button type="button" on:click={() => updateChecker.checkForUpdate($siteSettingsStore.betaUpdates)} data-testid="update-check-btn">
              Check for Updates
            </button>
          {/if}

          <label class="beta-toggle">
            <input
              type="checkbox"
              checked={$siteSettingsStore.betaUpdates ?? false}
              on:change={handleBetaToggle}
              data-testid="beta-updates-toggle"
            />
            <span>Receive beta updates</span>
          </label>
        </div>
      </section>
    {/if}

    {#if showBetaConfirm}
      <div class="modal-backdrop" role="presentation" on:click={cancelBetaConfirm}>
        <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="beta-confirm-title" tabindex="-1" on:click|stopPropagation on:keydown={(e) => { if (e.key === 'Escape') cancelBetaConfirm(); }}>
          <h3 id="beta-confirm-title">Enable Beta Updates?</h3>
          <p>Beta updates are pre-release versions that may contain bugs or incomplete features. They are intended for testing purposes only.</p>
          <p><strong>Only enable this if you are comfortable troubleshooting issues.</strong></p>
          <div class="confirm-actions">
            <button type="button" on:click={cancelBetaConfirm}>Cancel</button>
            <button type="button" class="primary" on:click={confirmEnableBeta} data-testid="beta-confirm-btn">Enable Beta Updates</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <div data-testid="sites-management">
    <ParkingLocationsPanel
      locations={$rvReservationStore.parkingLocations}
      reservationCounts={reservationCountsByLocation}
      siteColors={$siteSettingsStore.siteColors ?? {}}
      errorMessage={locationPanelError}
      on:add={handleAddLocation}
      on:rename={handleRenameLocation}
      on:remove={handleDeleteLocation}
      on:reorder={handleReorderLocations}
      on:colorchange={handleColorChange}
      on:clearerror={() => (locationPanelError = '')}
    />
  </div>

  {#if appVersion}
    <footer class="app-version" data-testid="app-version">
      Version {appVersion}
    </footer>
  {/if}
</div>

<style>
  .page-shell {
    padding: 0.5rem 1rem;
    display: grid;
    gap: 0.75rem;
    max-width: 46rem;
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
    min-height: 48px;
  }

  .toolbar-title {
    margin: 0;
    font-size: 1.1rem;
    white-space: nowrap;
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

  .panel {
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(214, 222, 234, 0.9);
    border-radius: 14px;
    box-shadow: var(--shadow);
    padding: 1rem;
  }

  h2 {
    margin: 0;
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
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    color: #1c2e45;
    min-height: 44px;
  }

  input:focus {
    background: white;
    border-color: #0a63e0;
  }

  button {
    width: fit-content;
    border-radius: 10px;
    border: 1px solid #c1cada;
    background: #f6f8fb;
    color: #203045;
    padding: 0.6rem 0.85rem;
    cursor: pointer;
    font-weight: 600;
    min-height: 44px;
  }

  button.primary {
    background: #0c5fdb;
    border-color: #0c5fdb;
    color: white;
  }

  button.primary:hover {
    background: #0757c8;
  }

  .meta {
    color: #5c6b7e;
    font-size: 0.85rem;
  }

  .backup-error {
    display: grid;
    gap: 0.2rem;
    background: #fff1f1;
    border: 1px solid #f1a2a2;
    color: #7a1e1e;
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    font-size: 0.85rem;
  }

  .backup-error strong {
    font-size: 0.9rem;
  }

  .failure-count {
    color: #a44;
    font-size: 0.8rem;
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
    min-height: auto;
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

  .app-version {
    text-align: center;
    color: #8995a5;
    font-size: 0.8rem;
    padding: 0.5rem 0 0.25rem;
  }

  .update-status {
    font-size: 0.9rem;
    color: #3d5a78;
  }

  .update-status.success {
    color: #166534;
    font-weight: 600;
  }

  .update-status.error {
    color: #892727;
  }

  .progress-bar {
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #0c5fdb;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .folder-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .folder-row input {
    flex: 1;
    min-width: 0;
  }

  select {
    font: inherit;
    width: 100%;
    border-radius: 10px;
    border: 1px solid #c3cddd;
    background: #f4f7fc;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    color: #1c2e45;
    min-height: 44px;
  }

  select:focus {
    background: white;
    border-color: #0a63e0;
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .beta-badge {
    display: inline-block;
    background: #e69f00;
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    vertical-align: middle;
    margin-left: 0.35rem;
  }

  .beta-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    cursor: pointer;
  }

  .beta-toggle input {
    width: auto;
    margin: 0;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: grid;
    place-items: center;
    z-index: 100;
  }

  .confirm-dialog {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 420px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .confirm-dialog h3 {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
  }

  .confirm-dialog p {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: #444;
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }

</style>
