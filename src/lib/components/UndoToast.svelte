<script lang="ts">
  import { canUndo, undo } from '$lib/app/undo';

  let undoneMessage = '';
  let undoneTimer: ReturnType<typeof setTimeout> | null = null;

  export async function handleUndo(): Promise<void> {
    const result = await undo();
    if (result.ok && result.label) {
      undoneMessage = `Undid: ${result.label}`;
      if (undoneTimer) clearTimeout(undoneTimer);
      undoneTimer = setTimeout(() => {
        undoneMessage = '';
        undoneTimer = null;
      }, 3000);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ($canUndo) {
        event.preventDefault();
        handleUndo();
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if undoneMessage}
  <div class="undone-toast" role="status" aria-live="polite" data-testid="undone-toast">
    {undoneMessage}
  </div>
{/if}

<style>
  .undone-toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: #166534;
    color: white;
    padding: 0.6rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(15, 28, 47, 0.2);
    z-index: 201;
    animation: toast-in 0.25s ease-out;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
