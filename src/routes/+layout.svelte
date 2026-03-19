<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { registerPersistenceLifecycleHandlers } from '$lib/app/composition';

  onMount(() => {
    let cleanup = () => {};
    void registerPersistenceLifecycleHandlers().then((dispose) => {
      cleanup = dispose;
    });

    return () => cleanup();
  });
</script>

<slot />
