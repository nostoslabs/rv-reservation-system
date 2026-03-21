<script lang="ts">
  import '../app.css';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import { getAppServices, registerPersistenceLifecycleHandlers } from '$lib/app/composition';
  import { startAutoBackupTimer } from '$lib/app/auto-backup';
  import { createBackup } from '$lib/domain/backup';
  import { siteSettingsStore } from '$lib/site-settings';
  import { rvReservationStore } from '$lib/state';
  import { customerStore } from '$lib/customer-state';

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

      const { desktop } = getAppServices();
      if (!desktop.isDesktop) return;

      stopAutoBackup = startAutoBackupTimer({
        getConfig: () => {
          const settings = get(siteSettingsStore);
          return settings.autoBackup ?? { intervalMinutes: 0, directoryPath: null, lastBackupAt: null };
        },
        getBackupContent: () => {
          const state = get(rvReservationStore);
          const settings = get(siteSettingsStore);
          const customers = customerStore.getAll();
          const backup = createBackup(state.reservations, state.parkingLocations, settings, customers);
          return JSON.stringify(backup, null, 2);
        },
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
