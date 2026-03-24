import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { pushUndo, undo, clearUndo, canUndo, lastLabel } from '$lib/app/undo';

beforeEach(() => {
	clearUndo();
});

describe('undo service', () => {
	it('starts with empty state', () => {
		expect(get(canUndo)).toBe(false);
		expect(get(lastLabel)).toBeNull();
	});

	it('pushUndo makes canUndo true', () => {
		pushUndo('Test action', async () => {});
		expect(get(canUndo)).toBe(true);
		expect(get(lastLabel)).toBe('Test action');
	});

	it('undo pops the last entry and calls its function', async () => {
		let called = false;
		pushUndo('Action 1', async () => { called = true; });

		const result = await undo();
		expect(result.ok).toBe(true);
		expect(result.label).toBe('Action 1');
		expect(called).toBe(true);
		expect(get(canUndo)).toBe(false);
	});

	it('undo returns false when stack is empty', async () => {
		const result = await undo();
		expect(result.ok).toBe(false);
	});

	it('maintains LIFO order', async () => {
		const order: string[] = [];
		pushUndo('First', async () => { order.push('first'); });
		pushUndo('Second', async () => { order.push('second'); });

		expect(get(lastLabel)).toBe('Second');

		await undo();
		expect(order).toEqual(['second']);
		expect(get(lastLabel)).toBe('First');

		await undo();
		expect(order).toEqual(['second', 'first']);
		expect(get(canUndo)).toBe(false);
	});

	it('caps stack at 20 entries', () => {
		for (let i = 0; i < 25; i++) {
			pushUndo(`Action ${i}`, async () => {});
		}

		// Should only have 20 entries, oldest (0-4) trimmed
		expect(get(lastLabel)).toBe('Action 24');

		// Pop all 20
		let count = 0;
		const labels: string[] = [];
		const sub = canUndo.subscribe((val) => {
			if (!val && count > 0) return;
		});
		sub();

		// Verify we can undo 20 times
		for (let i = 0; i < 21; i++) {
			if (!get(canUndo)) break;
			count++;
			undo();
		}
		expect(count).toBe(20);
	});

	it('clearUndo empties the stack', () => {
		pushUndo('Action', async () => {});
		expect(get(canUndo)).toBe(true);

		clearUndo();
		expect(get(canUndo)).toBe(false);
		expect(get(lastLabel)).toBeNull();
	});

	it('handles undo function that throws', async () => {
		pushUndo('Bad action', async () => { throw new Error('fail'); });

		const result = await undo();
		expect(result.ok).toBe(false);
		expect(get(canUndo)).toBe(false);
	});
});
