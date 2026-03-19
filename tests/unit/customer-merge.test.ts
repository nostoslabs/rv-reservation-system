import { describe, it, expect } from 'vitest';
import { resolveCustomerMerge, findDuplicateGroups } from '$lib/domain/customers';
import type { Customer } from '$lib/domain/customers';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: crypto.randomUUID(),
		name: 'John Smith',
		phone: '555-1234',
		email: 'john@test.com',
		notes: '',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides
	};
}

const NOW = '2026-03-18T12:00:00.000Z';

describe('resolveCustomerMerge', () => {
	it('throws on fewer than 2 customers', () => {
		expect(() => resolveCustomerMerge([], NOW)).toThrow();
		expect(() => resolveCustomerMerge([makeCustomer()], NOW)).toThrow();
	});

	it('winner ID is most recently updated', () => {
		const older = makeCustomer({ id: 'old', updatedAt: '2025-01-01T00:00:00.000Z' });
		const newer = makeCustomer({ id: 'new', updatedAt: '2025-06-01T00:00:00.000Z' });

		const result = resolveCustomerMerge([older, newer], NOW);
		expect(result.winner.id).toBe('new');
		expect(result.loserIds).toEqual(['old']);
	});

	it('name: picks longest; same length picks most recent', () => {
		const a = makeCustomer({
			name: 'Bob',
			updatedAt: '2025-06-01T00:00:00.000Z'
		});
		const b = makeCustomer({
			name: 'Bobby Smith',
			updatedAt: '2025-01-01T00:00:00.000Z'
		});

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.name).toBe('Bobby Smith');
	});

	it('name: same length picks most recently updated', () => {
		const a = makeCustomer({
			name: 'Alice',
			updatedAt: '2025-06-01T00:00:00.000Z'
		});
		const b = makeCustomer({
			name: 'Bobby',
			updatedAt: '2025-01-01T00:00:00.000Z'
		});

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.name).toBe('Alice');
	});

	it('phone: picks non-empty; both non-empty picks most recent', () => {
		const a = makeCustomer({
			phone: '555-OLD',
			updatedAt: '2025-01-01T00:00:00.000Z'
		});
		const b = makeCustomer({
			phone: '555-NEW',
			updatedAt: '2025-06-01T00:00:00.000Z'
		});

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.phone).toBe('555-NEW');
	});

	it('phone: picks non-empty when one is empty', () => {
		const a = makeCustomer({ phone: '', updatedAt: '2025-06-01T00:00:00.000Z' });
		const b = makeCustomer({ phone: '555-1234', updatedAt: '2025-01-01T00:00:00.000Z' });

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.phone).toBe('555-1234');
	});

	it('email: picks non-empty; both non-empty picks most recent', () => {
		const a = makeCustomer({
			email: 'old@test.com',
			updatedAt: '2025-01-01T00:00:00.000Z'
		});
		const b = makeCustomer({
			email: 'new@test.com',
			updatedAt: '2025-06-01T00:00:00.000Z'
		});

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.email).toBe('new@test.com');
	});

	it('email: picks non-empty when one is empty', () => {
		const a = makeCustomer({ email: '', updatedAt: '2025-06-01T00:00:00.000Z' });
		const b = makeCustomer({ email: 'valid@test.com', updatedAt: '2025-01-01T00:00:00.000Z' });

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.email).toBe('valid@test.com');
	});

	it('notes: concatenates unique, deduplicates identical', () => {
		const a = makeCustomer({ notes: 'Note A', updatedAt: '2025-06-01T00:00:00.000Z' });
		const b = makeCustomer({ notes: 'Note B', updatedAt: '2025-03-01T00:00:00.000Z' });
		const c = makeCustomer({ notes: 'Note A', updatedAt: '2025-01-01T00:00:00.000Z' });

		const result = resolveCustomerMerge([a, b, c], NOW);
		expect(result.winner.notes).toBe('Note A\nNote B');
	});

	it('notes: truncates at 500 characters', () => {
		const longNote = 'x'.repeat(300);
		const a = makeCustomer({ notes: longNote, updatedAt: '2025-06-01T00:00:00.000Z' });
		const b = makeCustomer({ notes: longNote + 'extra', updatedAt: '2025-01-01T00:00:00.000Z' });

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.notes.length).toBeLessThanOrEqual(500);
	});

	it('createdAt: picks earliest; updatedAt: uses now', () => {
		const a = makeCustomer({
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2025-06-01T00:00:00.000Z'
		});
		const b = makeCustomer({
			createdAt: '2025-03-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z'
		});

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.createdAt).toBe('2024-01-01T00:00:00.000Z');
		expect(result.winner.updatedAt).toBe(NOW);
	});

	it('loserIds: correct set', () => {
		const a = makeCustomer({ id: 'a', updatedAt: '2025-06-01T00:00:00.000Z' });
		const b = makeCustomer({ id: 'b', updatedAt: '2025-01-01T00:00:00.000Z' });

		const result = resolveCustomerMerge([a, b], NOW);
		expect(result.winner.id).toBe('a');
		expect(result.loserIds).toEqual(['b']);
	});

	it('three+ customers: correct across all fields', () => {
		const a = makeCustomer({
			id: 'a',
			name: 'Bob',
			phone: '',
			email: '',
			notes: 'Note 1',
			createdAt: '2025-03-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z'
		});
		const b = makeCustomer({
			id: 'b',
			name: 'Bobby Smith',
			phone: '555-1234',
			email: 'bob@test.com',
			notes: 'Note 2',
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2025-06-01T00:00:00.000Z'
		});
		const c = makeCustomer({
			id: 'c',
			name: 'Bobby',
			phone: '555-9999',
			email: '',
			notes: '',
			createdAt: '2025-06-01T00:00:00.000Z',
			updatedAt: '2025-03-01T00:00:00.000Z'
		});

		const result = resolveCustomerMerge([a, b, c], NOW);

		expect(result.winner.id).toBe('b');
		expect(result.winner.name).toBe('Bobby Smith');
		expect(result.winner.phone).toBe('555-1234');
		expect(result.winner.email).toBe('bob@test.com');
		expect(result.winner.notes).toBe('Note 2\nNote 1');
		expect(result.winner.createdAt).toBe('2024-01-01T00:00:00.000Z');
		expect(result.winner.updatedAt).toBe(NOW);
		expect(result.loserIds).toContain('a');
		expect(result.loserIds).toContain('c');
		expect(result.loserIds).toHaveLength(2);
	});
});

describe('findDuplicateGroups', () => {
	it('no duplicates returns empty array', () => {
		const customers = [
			makeCustomer({ name: 'Alice', phone: '111' }),
			makeCustomer({ name: 'Bob', phone: '222' })
		];
		expect(findDuplicateGroups(customers)).toEqual([]);
	});

	it('same name + phone grouped together', () => {
		const a = makeCustomer({ name: 'John Smith', phone: '555-1234' });
		const b = makeCustomer({ name: 'John Smith', phone: '555-1234' });

		const groups = findDuplicateGroups([a, b]);
		expect(groups).toHaveLength(1);
		expect(groups[0]).toHaveLength(2);
	});

	it('same name both no-phone grouped together', () => {
		const a = makeCustomer({ name: 'Bobby Smith', phone: '' });
		const b = makeCustomer({ name: 'Bobby Smith', phone: '' });

		const groups = findDuplicateGroups([a, b]);
		expect(groups).toHaveLength(1);
		expect(groups[0]).toHaveLength(2);
	});

	it('same name different phones not grouped', () => {
		const a = makeCustomer({ name: 'John Smith', phone: '555-1111' });
		const b = makeCustomer({ name: 'John Smith', phone: '555-2222' });

		const groups = findDuplicateGroups([a, b]);
		expect(groups).toEqual([]);
	});

	it('multiple separate pairs produce multiple groups', () => {
		const a1 = makeCustomer({ name: 'Alice', phone: '111' });
		const a2 = makeCustomer({ name: 'Alice', phone: '111' });
		const b1 = makeCustomer({ name: 'Bob', phone: '222' });
		const b2 = makeCustomer({ name: 'Bob', phone: '222' });
		const solo = makeCustomer({ name: 'Charlie', phone: '333' });

		const groups = findDuplicateGroups([a1, a2, b1, b2, solo]);
		expect(groups).toHaveLength(2);
	});

	it('normalizes name for comparison', () => {
		const a = makeCustomer({ name: '  John   Smith  ', phone: '555-1234' });
		const b = makeCustomer({ name: 'John Smith', phone: '555-1234' });

		const groups = findDuplicateGroups([a, b]);
		expect(groups).toHaveLength(1);
	});
});
