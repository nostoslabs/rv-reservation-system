<script lang="ts">
  import { onMount } from 'svelte';
  import { DEFAULT_SITE_NAME } from '$lib/storage';
  import { siteSettingsStore } from '$lib/site-settings';

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

  $: hasPasscode = $siteSettingsStore.adminPasscode.length > 0;

  onMount(() => {
    siteSettingsStore.hydrate();
    siteNameDraft = $siteSettingsStore.siteName;
  });

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
  <title>Admin | {$siteSettingsStore.siteName}</title>
  <meta name="description" content="Admin settings for RV Reservation Demo." />
</svelte:head>

<div class="admin-shell">
  <header class="admin-header">
    <p class="eyebrow">Hidden Route</p>
    <h1>Admin</h1>
    <p>
      This page is intentionally not linked from the main UI. It controls local settings only.
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

  .eyebrow {
    margin: 0;
    color: #466684;
    font-weight: 700;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
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
</style>
