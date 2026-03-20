import { describe, it, expect, beforeEach } from 'vitest';
import {
	createMergeCustomersUseCases,
	type MergeCustomersUseCases
} from '$lib/application/use-cases/merge-customers-use-case';
import type { CustomerRepository } from '$lib/application/ports/customer';
import type { Customer } from '$lib/domain/customers';
import type { PersistedAppData } from '$lib/types';

function createInMemoryCustomerRepository(): CustomerRepository {
	let customers: Customer[] = [];

	return {
		getAll() {
			return [...customers];
		},
		getById(id: string) {
			return customers.find((c) => c.id === id) ?? null;
		},
		async save(customer: Customer) {
			const idx = customers.findIndex((c) => c.id === customer.id);
			if (idx >= 0) {
				customers[idx] = customer;
			} else {
				customers.push(customer);
			}
		},
		async remove(id: string) {
			customers = customers.filter((c) => c.id !== id);
		},
		async replaceAll(newCustomers: Customer[]) {
			customers = [...newCustomers];
		}
	};
}

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

function makeAppData(reservations: PersistedAppData['reservations'] = []): PersistedAppData {
	return {
		version: 1,
		reservations,
		parkingLocations: ['A1'],
		nextReservationIndex: reservations.length + 1,
		lastSavedAt: null
	};
}

describe('MergeCustomersUseCases', () => {
	let repo: CustomerRepository;
	let useCases: MergeCustomersUseCases;

	beforeEach(() => {
		repo = createInMemoryCustomerRepository();
		useCases = createMergeCustomersUseCases(repo);
	});

	describe('merge', () => {
		it('merges two customers: winner saved, loser removed from repo', async () => {
			const a = makeCustomer({ id: 'a', name: 'Bob', updatedAt: '2025-01-01T00:00:00.000Z' });
			const b = makeCustomer({ id: 'b', name: 'Bobby', updatedAt: '2025-06-01T00:00:00.000Z' });
			await repo.save(a);
			await repo.save(b);

			const result = await useCases.merge(['a', 'b'], makeAppData());
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.winner.id).toBe('b');
			expect(repo.getById('b')).not.toBeNull();
			expect(repo.getById('a')).toBeNull();
			expect(repo.getAll()).toHaveLength(1);
		});

		it('re-links reservations with loser customerId to winner', async () => {
			const a = makeCustomer({ id: 'a', updatedAt: '2025-01-01T00:00:00.000Z' });
			const b = makeCustomer({ id: 'b', updatedAt: '2025-06-01T00:00:00.000Z' });
			await repo.save(a);
			await repo.save(b);

			const appData = makeAppData([
				{
					index: 1,
					firstCellId: 'c1',
					name: 'John Smith',
					phoneNumber: '555-1234',
					notes: '',
					startDate: '2025-07-01',
					endDate: '2025-07-05',
					parkingLocation: 'A1',
					color: 'blue',
					status: 'reserved',
					customerId: 'a'
				}
			]);

			const result = await useCases.merge(['a', 'b'], appData);
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.reservationsRelinked).toBe(1);
			expect(result.data.reservations[0].customerId).toBe('b');
		});

		it('legacy reservations (no customerId) matched by name+phone to loser are re-linked', async () => {
			const a = makeCustomer({
				id: 'a',
				name: 'John Smith',
				phone: '555-1234',
				updatedAt: '2025-01-01T00:00:00.000Z'
			});
			const b = makeCustomer({
				id: 'b',
				name: 'John Smith',
				phone: '555-1234',
				updatedAt: '2025-06-01T00:00:00.000Z'
			});
			await repo.save(a);
			await repo.save(b);

			const appData = makeAppData([
				{
					index: 1,
					firstCellId: 'c1',
					name: 'John Smith',
					phoneNumber: '555-1234',
					notes: '',
					startDate: '2025-07-01',
					endDate: '2025-07-05',
					parkingLocation: 'A1',
					color: 'blue',
					status: 'reserved'
					// no customerId
				}
			]);

			const result = await useCases.merge(['a', 'b'], appData);
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.reservationsRelinked).toBe(1);
			expect(result.data.reservations[0].customerId).toBe('b');
		});

		it('unrelated reservations are untouched', async () => {
			const a = makeCustomer({ id: 'a', updatedAt: '2025-01-01T00:00:00.000Z' });
			const b = makeCustomer({ id: 'b', updatedAt: '2025-06-01T00:00:00.000Z' });
			await repo.save(a);
			await repo.save(b);

			const appData = makeAppData([
				{
					index: 1,
					firstCellId: 'c1',
					name: 'Other Person',
					phoneNumber: '999-9999',
					notes: '',
					startDate: '2025-07-01',
					endDate: '2025-07-05',
					parkingLocation: 'A1',
					color: 'blue',
					status: 'reserved',
					customerId: 'other-id'
				}
			]);

			const result = await useCases.merge(['a', 'b'], appData);
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.reservationsRelinked).toBe(0);
			expect(result.data.reservations[0].customerId).toBe('other-id');
		});

		it('overrides applied to winner', async () => {
			const a = makeCustomer({ id: 'a', name: 'Bob', updatedAt: '2025-01-01T00:00:00.000Z' });
			const b = makeCustomer({ id: 'b', name: 'Bobby', updatedAt: '2025-06-01T00:00:00.000Z' });
			await repo.save(a);
			await repo.save(b);

			const result = await useCases.merge(['a', 'b'], makeAppData(), { name: 'Robert Smith' });
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.winner.name).toBe('Robert Smith');
		});

		it('rejects fewer than 2 IDs', async () => {
			const result = await useCases.merge(['a'], makeAppData());
			expect(result.ok).toBe(false);
		});

		it('rejects unknown ID', async () => {
			const a = makeCustomer({ id: 'a' });
			await repo.save(a);

			const result = await useCases.merge(['a', 'missing'], makeAppData());
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('missing');
			}
		});

		it('three customers merged correctly', async () => {
			const a = makeCustomer({ id: 'a', updatedAt: '2025-01-01T00:00:00.000Z' });
			const b = makeCustomer({ id: 'b', updatedAt: '2025-06-01T00:00:00.000Z' });
			const c = makeCustomer({ id: 'c', updatedAt: '2025-03-01T00:00:00.000Z' });
			await repo.save(a);
			await repo.save(b);
			await repo.save(c);

			const result = await useCases.merge(['a', 'b', 'c'], makeAppData());
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.mergedCount).toBe(3);
			expect(repo.getAll()).toHaveLength(1);
		});
	});

	describe('findDuplicates', () => {
		it('delegates correctly to domain logic', async () => {
			const a = makeCustomer({ name: 'John', phone: '555' });
			const b = makeCustomer({ name: 'John', phone: '555' });
			const c = makeCustomer({ name: 'Alice', phone: '111' });
			await repo.save(a);
			await repo.save(b);
			await repo.save(c);

			const groups = useCases.findDuplicates();
			expect(groups).toHaveLength(1);
			expect(groups[0]).toHaveLength(2);
		});
	});

	describe('deduplicateAll', () => {
		it('merges multiple groups with correct counts', async () => {
			const a1 = makeCustomer({ id: 'a1', name: 'Alice', phone: '111', updatedAt: '2025-01-01T00:00:00.000Z' });
			const a2 = makeCustomer({ id: 'a2', name: 'Alice', phone: '111', updatedAt: '2025-06-01T00:00:00.000Z' });
			const b1 = makeCustomer({ id: 'b1', name: 'Bob', phone: '222', updatedAt: '2025-01-01T00:00:00.000Z' });
			const b2 = makeCustomer({ id: 'b2', name: 'Bob', phone: '222', updatedAt: '2025-06-01T00:00:00.000Z' });
			await repo.save(a1);
			await repo.save(a2);
			await repo.save(b1);
			await repo.save(b2);

			const appData = makeAppData([
				{
					index: 1,
					firstCellId: 'c1',
					name: 'Alice',
					phoneNumber: '111',
					notes: '',
					startDate: '2025-07-01',
					endDate: '2025-07-05',
					parkingLocation: 'A1',
					color: 'blue',
					status: 'reserved',
					customerId: 'a1'
				}
			]);

			const result = await useCases.deduplicateAll(appData);
			expect(result.groupsMerged).toBe(2);
			expect(result.reservationsRelinked).toBe(1);
			expect(repo.getAll()).toHaveLength(2);
		});

		it('no duplicates: zero changes, data unchanged', async () => {
			const a = makeCustomer({ name: 'Alice', phone: '111' });
			const b = makeCustomer({ name: 'Bob', phone: '222' });
			await repo.save(a);
			await repo.save(b);

			const appData = makeAppData();
			const result = await useCases.deduplicateAll(appData);
			expect(result.groupsMerged).toBe(0);
			expect(result.reservationsRelinked).toBe(0);
			expect(result.data).toEqual(appData);
		});
	});
});
