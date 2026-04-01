import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Customer } from '$lib/domain/customers';

// We need to mock the browser environment for localStorage access
vi.mock('$app/environment', () => ({ browser: true }));

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: 'cust-1',
		name: 'Test Guest',
		phone: '555-1234',
		rvType: '',
		email: '',
		notes: '',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides
	};
}

describe('LocalStorage CustomerRepository', () => {
	let mockStorage: Record<string, string>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let setItemSpy: any;

	beforeEach(() => {
		mockStorage = {};
		setItemSpy = vi.fn();
		vi.stubGlobal('window', {
			localStorage: {
				getItem: (key: string) => mockStorage[key] ?? null,
				setItem: (key: string, value: string) => {
					setItemSpy(key, value);
					mockStorage[key] = value;
				},
				removeItem: (key: string) => {
					delete mockStorage[key];
				}
			}
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	async function createRepo() {
		const mod = await import('$lib/infrastructure/storage/localstorage/customer-repository');
		return mod.createLocalStorageCustomerRepository();
	}

	describe('happy path', () => {
		it('save adds a new customer', async () => {
			const repo = await createRepo();
			const customer = makeCustomer();
			repo.save(customer);
			expect(repo.getAll()).toEqual([customer]);
		});

		it('save updates an existing customer', async () => {
			const repo = await createRepo();
			const customer = makeCustomer();
			repo.save(customer);
			const updated = { ...customer, name: 'Updated Name' };
			repo.save(updated);
			expect(repo.getAll()).toEqual([updated]);
		});

		it('remove deletes a customer', async () => {
			const repo = await createRepo();
			repo.save(makeCustomer());
			repo.remove('cust-1');
			expect(repo.getAll()).toEqual([]);
		});

		it('replaceAll replaces all customers', async () => {
			const repo = await createRepo();
			repo.save(makeCustomer());
			const newCustomers = [makeCustomer({ id: 'cust-2', name: 'New Guest' })];
			repo.replaceAll(newCustomers);
			expect(repo.getAll()).toEqual(newCustomers);
		});
	});

	describe('quota exceeded — in-memory state must not be corrupted', () => {
		it('save failure leaves getAll unchanged', async () => {
			const repo = await createRepo();
			const original = makeCustomer({ id: 'cust-1', name: 'Original' });
			repo.save(original);

			// Make the next setItem throw
			setItemSpy.mockImplementation(() => {
				throw new DOMException('quota exceeded', 'QuotaExceededError');
			});

			const newCustomer = makeCustomer({ id: 'cust-2', name: 'Should Not Persist' });
			expect(() => repo.save(newCustomer)).toThrow('quota exceeded');
			expect(repo.getAll()).toEqual([original]);
		});

		it('save update failure preserves original version', async () => {
			const repo = await createRepo();
			const original = makeCustomer({ id: 'cust-1', name: 'Original' });
			repo.save(original);

			setItemSpy.mockImplementation(() => {
				throw new DOMException('quota exceeded', 'QuotaExceededError');
			});

			const updated = { ...original, name: 'Updated Name' };
			expect(() => repo.save(updated)).toThrow('quota exceeded');
			expect(repo.getAll()[0].name).toBe('Original');
		});

		it('remove failure keeps the customer in the list', async () => {
			const repo = await createRepo();
			const customer = makeCustomer();
			repo.save(customer);

			setItemSpy.mockImplementation(() => {
				throw new DOMException('quota exceeded', 'QuotaExceededError');
			});

			expect(() => repo.remove('cust-1')).toThrow('quota exceeded');
			expect(repo.getAll()).toEqual([customer]);
		});

		it('replaceAll failure preserves original customers', async () => {
			const repo = await createRepo();
			const original = makeCustomer({ id: 'cust-1', name: 'Original' });
			repo.save(original);

			setItemSpy.mockImplementation(() => {
				throw new DOMException('quota exceeded', 'QuotaExceededError');
			});

			const newCustomers = [makeCustomer({ id: 'cust-2', name: 'New' })];
			expect(() => repo.replaceAll(newCustomers)).toThrow('quota exceeded');
			expect(repo.getAll()).toEqual([original]);
		});
	});
});
