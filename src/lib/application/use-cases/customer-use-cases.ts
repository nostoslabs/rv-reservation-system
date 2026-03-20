import type { CustomerRepository } from '$lib/application/ports/customer';
import type { Customer, CustomerFormValues, CustomerSearchResult } from '$lib/domain/customers';
import {
	validateCustomerForm,
	searchCustomers,
	findDuplicateCustomer,
	normalizeName,
	normalizePhoneNumber,
	normalizeEmail,
	parseCustomerCsv
} from '$lib/domain/customers';

export interface CustomerUseCases {
	getAll(): Customer[];
	getById(id: string): Customer | null;
	create(form: CustomerFormValues): Promise<{ ok: true; customer: Customer } | { ok: false; errors: string[] }>;
	update(form: CustomerFormValues): Promise<{ ok: true; customer: Customer } | { ok: false; errors: string[] }>;
	remove(id: string): Promise<{ ok: true } | { ok: false; errors: string[] }>;
	search(query: string): CustomerSearchResult[];
	findOrCreateFromReservation(name: string, phone: string): Promise<Customer | null>;
	importCsv(csvText: string): Promise<{ imported: number; skipped: number; errors: string[] }>;
	replaceAll(customers: Customer[]): Promise<void>;
}

export function createCustomerUseCases(repo: CustomerRepository): CustomerUseCases {
	function nowIso(): string {
		return new Date().toISOString();
	}

	return {
		getAll(): Customer[] {
			return repo.getAll();
		},

		getById(id: string): Customer | null {
			return repo.getById(id);
		},

		async create(form: CustomerFormValues) {
			const errors = validateCustomerForm(form);
			if (errors.length > 0) {
				return { ok: false as const, errors };
			}

			const now = nowIso();
			const customer: Customer = {
				id: crypto.randomUUID(),
				name: normalizeName(form.name),
				phone: normalizePhoneNumber(form.phone),
				email: normalizeEmail(form.email),
				notes: form.notes.trim(),
				createdAt: now,
				updatedAt: now
			};

			await repo.save(customer);
			return { ok: true as const, customer };
		},

		async update(form: CustomerFormValues) {
			if (!form.id) {
				return { ok: false as const, errors: ['Customer ID is required.'] };
			}

			const existing = repo.getById(form.id);
			if (!existing) {
				return { ok: false as const, errors: ['Customer not found.'] };
			}

			const errors = validateCustomerForm(form);
			if (errors.length > 0) {
				return { ok: false as const, errors };
			}

			const customer: Customer = {
				...existing,
				name: normalizeName(form.name),
				phone: normalizePhoneNumber(form.phone),
				email: normalizeEmail(form.email),
				notes: form.notes.trim(),
				updatedAt: nowIso()
			};

			await repo.save(customer);
			return { ok: true as const, customer };
		},

		async remove(id: string) {
			const existing = repo.getById(id);
			if (!existing) {
				return { ok: false as const, errors: ['Customer not found.'] };
			}

			await repo.remove(id);
			return { ok: true as const };
		},

		search(query: string): CustomerSearchResult[] {
			return searchCustomers(repo.getAll(), query);
		},

		async findOrCreateFromReservation(name: string, phone: string): Promise<Customer | null> {
			const normalizedName = normalizeName(name);
			if (!normalizedName) return null;

			const normalizedPhone = normalizePhoneNumber(phone);
			const allCustomers = repo.getAll();

			const existing = findDuplicateCustomer(allCustomers, normalizedName, normalizedPhone);
			if (existing) return existing;

			const now = nowIso();
			const customer: Customer = {
				id: crypto.randomUUID(),
				name: normalizedName,
				phone: normalizedPhone,
				email: '',
				notes: '',
				createdAt: now,
				updatedAt: now
			};

			await repo.save(customer);
			return customer;
		},

		async importCsv(csvText: string) {
			const parsed = parseCustomerCsv(csvText);
			let imported = 0;
			let skipped = 0;

			for (const row of parsed.rows) {
				const normalizedName = normalizeName(row.name);
				const normalizedPhone = normalizePhoneNumber(row.phone);
				const allCustomers = repo.getAll();

				const existing = findDuplicateCustomer(allCustomers, normalizedName, normalizedPhone);
				if (existing) {
					skipped++;
					continue;
				}

				const now = nowIso();
				const customer: Customer = {
					id: crypto.randomUUID(),
					name: normalizedName,
					phone: normalizedPhone,
					email: normalizeEmail(row.email),
					notes: row.notes.trim(),
					createdAt: now,
					updatedAt: now
				};

				await repo.save(customer);
				imported++;
			}

			return { imported, skipped, errors: parsed.errors };
		},

		async replaceAll(customers: Customer[]): Promise<void> {
			await repo.replaceAll(customers);
		}
	};
}
