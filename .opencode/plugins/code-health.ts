export const CodeHealthPlugin = async ({ $ }) => {
  let running = false;

  const runChangedCheck = async () => {
    if (running) return;
    running = true;
    try {
      await $`npm run code-health:changed`;
    } finally {
      running = false;
    }
  };

  return {
    event: async ({ event }) => {
      if (event?.type === 'file.edited') {
        await runChangedCheck();
      }
    },
    'tool.execute.after': async (input) => {
      const toolName = String(input?.tool ?? input?.toolName ?? '');
      if (toolName === 'Edit' || toolName === 'Write' || toolName === 'edit' || toolName === 'write') {
        await runChangedCheck();
      }
    }
  };
};
