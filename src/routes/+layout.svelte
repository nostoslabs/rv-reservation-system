<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { registerPersistenceLifecycleHandlers, flushPendingWrites } from '$lib/app/composition';

  onMount(() => {
    let dispose: (() => void) | null = null;
    let unmounted = false;

    registerPersistenceLifecycleHandlers().then((cleanup) => {
      if (unmounted) {
        cleanup();
      } else {
        dispose = cleanup;
      }
    });

    // Fallback: flush pending writes when the page is about to unload.
    // This covers scenarios where the Tauri close handler hasn't registered yet.
    const handleBeforeUnload = (): void => {
      // navigator.sendBeacon isn't applicable for SQLite, but triggering
      // the flush ensures the write queue starts draining. The Tauri close
      // handler (if registered) will await it properly.
      void flushPendingWrites();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unmounted = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      dispose?.();
    };
  });
</script>

<slot />
