<script lang="ts">
  import { canUndo, lastLabel, undo } from '$lib/app/undo';

  let undoneMessage = '';
  let undoneTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  $: if ($canUndo) {
    // Reset auto-hide timer whenever a new action is pushed
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      hideTimer = null;
    }, 8000);
  }

  $: visible = $canUndo && hideTimer !== null;

  async function handleUndo(): Promise<void> {
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
      // Don't trigger undo if user is typing in an input
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

{#if visible}
  <div class="undo-toast" role="status" aria-live="polite" data-testid="undo-toast">
    <span class="undo-label">Undo: {$lastLabel}</span>
    <button type="button" class="undo-btn" on:click={handleUndo} data-testid="undo-btn">Undo</button>
  </div>
{/if}

{#if undoneMessage}
  <div class="undone-toast" role="status" aria-live="polite" data-testid="undone-toast">
    {undoneMessage}
  </div>
{/if}

<style>
  .undo-toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: #1b304a;
    color: white;
    padding: 0.6rem 1rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(15, 28, 47, 0.25);
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: toast-in 0.25s ease-out;
  }

  .undo-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 20rem;
  }

  .undo-btn {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: white;
    padding: 0.35rem 0.75rem;
    border-radius: 8px;
    font: inherit;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    min-height: 32px;
  }

  .undo-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }

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
