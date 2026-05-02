<script lang="ts">
  import '../app.css';
  import { get } from 'svelte/store';
  import { onMount, setContext } from 'svelte';
  import { getAppServices, registerPersistenceLifecycleHandlers } from '$lib/app/composition';
  import { startAutoBackupTimer } from '$lib/app/auto-backup';
  import { createForcedBackup } from '$lib/app/forced-backup';
  import { createUpdateChecker } from '$lib/app/update-checker';
  import { createBackup } from '$lib/domain/backup';
  import { siteSettingsStore } from '$lib/site-settings';
  import { rvReservationStore } from '$lib/state';
  import { customerStore } from '$lib/customer-state';
  import UndoToast from '$lib/components/UndoToast.svelte';

  // Create update checker at component init so setContext works for child routes.
  // The actual check is deferred to onMount after persistence is ready.
  const { desktop } = getAppServices();
  function getBackupContent(): string {
    const state = get(rvReservationStore);
    const settings = get(siteSettingsStore);
    const customers = customerStore.getAll();
    const backup = createBackup(state.reservations, state.parkingLocations, settings, customers);
    return JSON.stringify(backup, null, 2);
  }

  const updateChecker = desktop.isDesktop ? createUpdateChecker(desktop, {
    createPreUpdateBackup: () => createForcedBackup({
      desktop,
      getBackupContent,
      getAutoBackupDirectory: () => get(siteSettingsStore).autoBackup?.directoryPath,
      onSuccess: async (timestamp) => { await siteSettingsStore.recordAutoBackup(timestamp); }
    })
  }) : null;
  if (updateChecker) {
    setContext('updateChecker', updateChecker);
  }

  onMount(() => {
    let dispose: (() => void) | null = null;
    let stopAutoBackup: (() => void) | null = null;
    let unmounted = false;

    registerPersistenceLifecycleHandlers().then((cleanup) => {
      if (unmounted) {
        cleanup();
        return;
      }
      dispose = cleanup;

      if (!desktop.isDesktop) return;

      const settings = get(siteSettingsStore);
      updateChecker?.checkForUpdate(settings.betaUpdates);

      stopAutoBackup = startAutoBackupTimer({
        getConfig: () => {
          const settings = get(siteSettingsStore);
          return settings.autoBackup ?? { intervalMinutes: 0, directoryPath: null, lastBackupAt: null };
        },
        getBackupContent,
        desktop,
        onSuccess: async (timestamp) => { await siteSettingsStore.recordAutoBackup(timestamp); },
        onError: (err) => console.error('Auto-backup failed:', err)
      });
    });

    return () => {
      unmounted = true;
      dispose?.();
      stopAutoBackup?.();
    };
  });
</script>

<slot />
<UndoToast />
