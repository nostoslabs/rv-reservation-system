import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomerUseCases, type CustomerUseCases } from '$lib/application/use-cases/customer-use-cases';
import type { CustomerRepository } from '$lib/application/ports/customer';
import type { Customer } from '$lib/domain/customers';

function createInMemoryCustomerRepository(): CustomerRepository {
	let customers: Customer[] = [];

	return {
		getAll() {
			return [...customers];
		},
		getById(id: string) {
			return customers.find((c) => c.id === id) ?? null;
		},
		save(customer: Customer) {
			const idx = customers.findIndex((c) => c.id === customer.id);
			if (idx >= 0) {
				customers[idx] = customer;
			} else {
				customers.push(customer);
			}
		},
		remove(id: string) {
			customers = customers.filter((c) => c.id !== id);
		},
		replaceAll(newCustomers: Customer[]) {
			customers = [...newCustomers];
		}
	};
}

describe('CustomerUseCases', () => {
	let repo: CustomerRepository;
	let useCases: CustomerUseCases;

	beforeEach(() => {
		repo = createInMemoryCustomerRepository();
		useCases = createCustomerUseCases(repo);
	});

	describe('create', () => {
		it('creates a customer with valid form', () => {
			const result = useCases.create({
				name: 'John Smith',
				phone: '555-1234',
				email: 'john@test.com',
				notes: 'Good customer'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.customer.name).toBe('John Smith');
				expect(result.customer.phone).toBe('555-1234');
				expect(result.customer.email).toBe('john@test.com');
				expect(result.customer.id).toBeTruthy();
			}
		});

		it('normalizes input fields', () => {
			const result = useCases.create({
				name: '  John   Smith  ',
				phone: '  555-1234  ',
				email: '  JOHN@TEST.COM  ',
				notes: '  Good customer  '
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.customer.name).toBe('John Smith');
				expect(result.customer.phone).toBe('555-1234');
				expect(result.customer.email).toBe('john@test.com');
				expect(result.customer.notes).toBe('Good customer');
			}
		});

		it('rejects invalid form', () => {
			const result = useCases.create({
				name: '',
				phone: '',
				email: '',
				notes: ''
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors).toContain('Name is required.');
			}
		});

		it('persists the customer', () => {
			useCases.create({ name: 'John', phone: '', email: '', notes: '' });
			expect(useCases.getAll()).toHaveLength(1);
		});
	});

	describe('update', () => {
		it('updates an existing customer', () => {
			const createResult = useCases.create({ name: 'John', phone: '555-1234', email: '', notes: '' });
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const updateResult = useCases.update({
				id: createResult.customer.id,
				name: 'John Smith',
				phone: '555-5678',
				email: 'john@test.com',
				notes: 'Updated'
			});
			expect(updateResult.ok).toBe(true);
			if (updateResult.ok) {
				expect(updateResult.customer.name).toBe('John Smith');
				expect(updateResult.customer.phone).toBe('555-5678');
			}
		});

		it('rejects missing id', () => {
			const result = useCases.update({ name: 'John', phone: '', email: '', notes: '' });
			expect(result.ok).toBe(false);
		});

		it('rejects non-existent customer', () => {
			const result = useCases.update({ id: 'missing', name: 'John', phone: '', email: '', notes: '' });
			expect(result.ok).toBe(false);
		});
	});

	describe('remove', () => {
		it('removes an existing customer', () => {
			const createResult = useCases.create({ name: 'John', phone: '', email: '', notes: '' });
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const result = useCases.remove(createResult.customer.id);
			expect(result.ok).toBe(true);
			expect(useCases.getAll()).toHaveLength(0);
		});

		it('rejects non-existent customer', () => {
			const result = useCases.remove('missing');
			expect(result.ok).toBe(false);
		});
	});

	describe('search', () => {
		it('searches customers by name', () => {
			useCases.create({ name: 'Alice Johnson', phone: '555-1111', email: '', notes: '' });
			useCases.create({ name: 'Bob Smith', phone: '555-2222', email: '', notes: '' });

			const results = useCases.search('alice');
			expect(results).toHaveLength(1);
			expect(results[0].customer.name).toBe('Alice Johnson');
		});
	});

	describe('findOrCreateFromReservation', () => {
		it('creates a new customer when no match exists', () => {
			const customer = useCases.findOrCreateFromReservation('John Smith', '555-1234');
			expect(customer).not.toBeNull();
			expect(customer!.name).toBe('John Smith');
			expect(useCases.getAll()).toHaveLength(1);
		});

		it('returns existing customer on exact match', () => {
			useCases.create({ name: 'John Smith', phone: '555-1234', email: '', notes: '' });
			const customer = useCases.findOrCreateFromReservation('John Smith', '555-1234');
			expect(customer).not.toBeNull();
			expect(useCases.getAll()).toHaveLength(1);
		});

		it('returns null for empty name', () => {
			const customer = useCases.findOrCreateFromReservation('', '555-1234');
			expect(customer).toBeNull();
		});

		it('creates new customer when phone is empty (no dedup possible)', () => {
			const customer = useCases.findOrCreateFromReservation('John Smith', '');
			expect(customer).not.toBeNull();
			expect(useCases.getAll()).toHaveLength(1);
		});
	});

	describe('importCsv', () => {
		it('imports valid CSV', () => {
			const csv = `name,phone,email,notes
John Smith,555-1234,john@test.com,Good
Jane Doe,555-5678,jane@test.com,Also good`;

			const result = useCases.importCsv(csv);
			expect(result.imported).toBe(2);
			expect(result.skipped).toBe(0);
			expect(result.errors).toEqual([]);
			expect(useCases.getAll()).toHaveLength(2);
		});

		it('skips duplicates', () => {
			useCases.create({ name: 'John Smith', phone: '555-1234', email: '', notes: '' });

			const csv = `name,phone
John Smith,555-1234
Jane Doe,555-5678`;

			const result = useCases.importCsv(csv);
			expect(result.imported).toBe(1);
			expect(result.skipped).toBe(1);
			expect(useCases.getAll()).toHaveLength(2);
		});

		it('returns parse errors', () => {
			const csv = `name,phone
,555-1234`;

			const result = useCases.importCsv(csv);
			expect(result.imported).toBe(0);
			expect(result.errors).toHaveLength(1);
		});
	});
});
