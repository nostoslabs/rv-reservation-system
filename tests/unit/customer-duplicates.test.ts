import { describe, it, expect } from 'vitest';
import { findDuplicateCustomer } from '$lib/domain/customers/duplicates';
import type { Customer } from '$lib/domain/customers';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: 'test-id',
		name: 'John Smith',
		phone: '555-1234',
		email: 'john@example.com',
		notes: '',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides
	};
}

const customers: Customer[] = [
	makeCustomer({ id: '1', name: 'Alice Johnson', phone: '555-1111' }),
	makeCustomer({ id: '2', name: 'Bob Smith', phone: '555-2222' }),
	makeCustomer({ id: '3', name: 'Charlie Brown', phone: '555-3333' })
];

describe('findDuplicateCustomer', () => {
	it('finds exact match on normalized name and phone', () => {
		const result = findDuplicateCustomer(customers, 'Alice Johnson', '555-1111');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('1');
	});

	it('matches case-insensitively', () => {
		const result = findDuplicateCustomer(customers, 'alice johnson', '555-1111');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('1');
	});

	it('normalizes whitespace in name', () => {
		const result = findDuplicateCustomer(customers, '  Alice   Johnson  ', '555-1111');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('1');
	});

	it('returns null when only name matches', () => {
		const result = findDuplicateCustomer(customers, 'Alice Johnson', '999-9999');
		expect(result).toBeNull();
	});

	it('returns null when only phone matches', () => {
		const result = findDuplicateCustomer(customers, 'Unknown Person', '555-1111');
		expect(result).toBeNull();
	});

	it('returns null when input phone is empty but candidate has phone', () => {
		const result = findDuplicateCustomer(customers, 'Alice Johnson', '');
		expect(result).toBeNull();
	});

	it('returns null when name is empty', () => {
		const result = findDuplicateCustomer(customers, '', '555-1111');
		expect(result).toBeNull();
	});

	it('returns null for empty customer list', () => {
		const result = findDuplicateCustomer([], 'Alice Johnson', '555-1111');
		expect(result).toBeNull();
	});

	it('returns null when no match', () => {
		const result = findDuplicateCustomer(customers, 'Unknown', '000-0000');
		expect(result).toBeNull();
	});

	it('matches on name alone when both phones are empty', () => {
		const noPhoneCustomers: Customer[] = [
			makeCustomer({ id: '10', name: 'No Phone Guest', phone: '' })
		];
		const result = findDuplicateCustomer(noPhoneCustomers, 'No Phone Guest', '');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('10');
	});

	it('does not match name-only when input has phone but candidate does not', () => {
		const noPhoneCustomers: Customer[] = [
			makeCustomer({ id: '10', name: 'No Phone Guest', phone: '' })
		];
		const result = findDuplicateCustomer(noPhoneCustomers, 'No Phone Guest', '555-9999');
		expect(result).toBeNull();
	});

	it('matches name-only case-insensitively when both phones empty', () => {
		const noPhoneCustomers: Customer[] = [
			makeCustomer({ id: '10', name: 'No Phone Guest', phone: '' })
		];
		const result = findDuplicateCustomer(noPhoneCustomers, '  no phone guest  ', '');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('10');
	});
});
