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
	create(form: CustomerFormValues): { ok: true; customer: Customer } | { ok: false; errors: string[] };
	update(form: CustomerFormValues): { ok: true; customer: Customer } | { ok: false; errors: string[] };
	remove(id: string): { ok: true } | { ok: false; errors: string[] };
	search(query: string): CustomerSearchResult[];
	findOrCreateFromReservation(name: string, phone: string): Customer | null;
	importCsv(csvText: string): { imported: number; skipped: number; errors: string[] };
	replaceAll(customers: Customer[]): void;
	restore(customer: Customer): void;
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

		create(form: CustomerFormValues) {
			const errors = validateCustomerForm(form);
			if (errors.length > 0) {
				return { ok: false as const, errors };
			}

			const now = nowIso();
			const customer: Customer = {
				id: crypto.randomUUID(),
				name: normalizeName(form.name),
				phone: normalizePhoneNumber(form.phone),
				rvType: (form.rvType ?? '').trim(),
				email: normalizeEmail(form.email),
				notes: form.notes.trim(),
				createdAt: now,
				updatedAt: now
			};

			repo.save(customer);
			return { ok: true as const, customer };
		},

		update(form: CustomerFormValues) {
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
				rvType: (form.rvType ?? '').trim(),
				email: normalizeEmail(form.email),
				notes: form.notes.trim(),
				updatedAt: nowIso()
			};

			repo.save(customer);
			return { ok: true as const, customer };
		},

		remove(id: string) {
			const existing = repo.getById(id);
			if (!existing) {
				return { ok: false as const, errors: ['Customer not found.'] };
			}

			repo.remove(id);
			return { ok: true as const };
		},

		search(query: string): CustomerSearchResult[] {
			return searchCustomers(repo.getAll(), query);
		},

		findOrCreateFromReservation(name: string, phone: string): Customer | null {
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
				rvType: '',
				email: '',
				notes: '',
				createdAt: now,
				updatedAt: now
			};

			repo.save(customer);
			return customer;
		},

		importCsv(csvText: string) {
			const parsed = parseCustomerCsv(csvText);
			let imported = 0;
			let skipped = 0;
			let knownCustomers = repo.getAll();

			for (const row of parsed.rows) {
				const normalizedName = normalizeName(row.name);
				const normalizedPhone = normalizePhoneNumber(row.phone);

				const existing = findDuplicateCustomer(knownCustomers, normalizedName, normalizedPhone);
				if (existing) {
					skipped++;
					continue;
				}

				const now = nowIso();
				const customer: Customer = {
					id: crypto.randomUUID(),
					name: normalizedName,
					phone: normalizedPhone,
					rvType: (row.rvType ?? '').trim(),
					email: normalizeEmail(row.email),
					notes: row.notes.trim(),
					createdAt: now,
					updatedAt: now
				};

				repo.save(customer);
				knownCustomers = [...knownCustomers, customer];
				imported++;
			}

			return { imported, skipped, errors: parsed.errors };
		},

		replaceAll(customers: Customer[]): void {
			repo.replaceAll(customers);
		},

		restore(customer: Customer): void {
			repo.save(customer);
		}
	};
}
