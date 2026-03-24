import { describe, it, expect } from 'vitest';
import { searchCustomers } from '$lib/domain/customers/search';
import type { Customer } from '$lib/domain/customers';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: 'test-id',
		name: 'John Smith',
		phone: '555-1234',
		rvType: '',
		email: 'john@example.com',
		notes: '',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides
	};
}

const sampleCustomers: Customer[] = [
	makeCustomer({ id: '1', name: 'Alice Johnson', phone: '555-1111', email: 'alice@test.com' }),
	makeCustomer({ id: '2', name: 'Bob Smith', phone: '555-2222', email: 'bob@test.com' }),
	makeCustomer({ id: '3', name: 'Charlie Brown', phone: '555-3333', email: 'charlie@test.com' }),
	makeCustomer({ id: '4', name: 'Alice Williams', phone: '555-4444', email: 'awilliams@test.com' }),
	makeCustomer({ id: '5', name: 'David Alice', phone: '555-5555', email: 'david@test.com' })
];

describe('searchCustomers', () => {
	it('returns empty array for empty query', () => {
		expect(searchCustomers(sampleCustomers, '')).toEqual([]);
	});

	it('returns empty array for whitespace-only query', () => {
		expect(searchCustomers(sampleCustomers, '   ')).toEqual([]);
	});

	it('returns empty array when no match', () => {
		expect(searchCustomers(sampleCustomers, 'Zephyr')).toEqual([]);
	});

	it('matches name case-insensitively', () => {
		const results = searchCustomers(sampleCustomers, 'alice');
		const names = results.map((r) => r.customer.name);
		expect(names).toContain('Alice Johnson');
		expect(names).toContain('Alice Williams');
		expect(names).toContain('David Alice');
	});

	it('matches phone number', () => {
		const results = searchCustomers(sampleCustomers, '555-2222');
		expect(results).toHaveLength(1);
		expect(results[0].customer.name).toBe('Bob Smith');
	});

	it('matches email', () => {
		const results = searchCustomers(sampleCustomers, 'charlie@test');
		expect(results).toHaveLength(1);
		expect(results[0].customer.name).toBe('Charlie Brown');
	});

	it('ranks exact matches above partial', () => {
		const customers = [
			makeCustomer({ id: '1', name: 'Alice' }),
			makeCustomer({ id: '2', name: 'Alice Johnson' }),
			makeCustomer({ id: '3', name: 'Wonderland Alice' })
		];
		const results = searchCustomers(customers, 'Alice');
		expect(results[0].customer.name).toBe('Alice');
		expect(results[0].score).toBe(0);
	});

	it('ranks startsWith above contains', () => {
		const customers = [
			makeCustomer({ id: '1', name: 'Mary Alice' }),
			makeCustomer({ id: '2', name: 'Alice Johnson' })
		];
		const results = searchCustomers(customers, 'Alice');
		expect(results[0].customer.name).toBe('Alice Johnson');
		expect(results[0].score).toBe(1);
		expect(results[1].customer.name).toBe('Mary Alice');
		expect(results[1].score).toBe(2);
	});

	it('sorts alphabetically within same score tier', () => {
		const results = searchCustomers(sampleCustomers, 'alice');
		expect(results[0].customer.name).toBe('Alice Johnson');
		expect(results[1].customer.name).toBe('Alice Williams');
		expect(results[2].customer.name).toBe('David Alice');
	});

	it('works with empty array', () => {
		expect(searchCustomers([], 'test')).toEqual([]);
	});

	it('trims query whitespace', () => {
		const results = searchCustomers(sampleCustomers, '  bob  ');
		expect(results).toHaveLength(1);
		expect(results[0].customer.name).toBe('Bob Smith');
	});
});
