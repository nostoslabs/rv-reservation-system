<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { registerPersistenceLifecycleHandlers } from '$lib/app/composition';

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

    return () => {
      unmounted = true;
      dispose?.();
    };
  });
</script>

<slot />
