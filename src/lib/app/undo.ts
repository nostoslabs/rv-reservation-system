import { writable, derived } from 'svelte/store';

interface UndoEntry {
	label: string;
	undoFn: () => Promise<void>;
}

const MAX_STACK_SIZE = 20;

const stack = writable<UndoEntry[]>([]);

export const canUndo = derived(stack, ($stack) => $stack.length > 0);
export const lastLabel = derived(stack, ($stack) => $stack.length > 0 ? $stack[$stack.length - 1].label : null);

export function pushUndo(label: string, undoFn: () => Promise<void>): void {
	stack.update((s) => {
		const next = [...s, { label, undoFn }];
		if (next.length > MAX_STACK_SIZE) {
			next.shift();
		}
		return next;
	});
}

export async function undo(): Promise<{ ok: boolean; label?: string }> {
	let entry: UndoEntry | undefined;

	stack.update((s) => {
		if (s.length === 0) return s;
		const next = [...s];
		entry = next.pop();
		return next;
	});

	if (!entry) return { ok: false };

	try {
		await entry.undoFn();
		return { ok: true, label: entry.label };
	} catch (err) {
		console.error('Undo failed:', err);
		return { ok: false };
	}
}

export function clearUndo(): void {
	stack.set([]);
}
