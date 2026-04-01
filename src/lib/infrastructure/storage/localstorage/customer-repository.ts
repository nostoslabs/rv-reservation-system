import { browser } from '$app/environment';
import type { CustomerRepository } from '$lib/application/ports/customer';
import type { Customer } from '$lib/domain/customers';
import {
	MAX_CUSTOMER_NAME_LENGTH,
	MAX_CUSTOMER_PHONE_LENGTH,
	MAX_CUSTOMER_RV_TYPE_LENGTH,
	MAX_CUSTOMER_EMAIL_LENGTH,
	MAX_CUSTOMER_NOTES_LENGTH
} from '$lib/domain/customers';

const STORAGE_KEY = 'rv-reservation-demo:customers:v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeCustomer(value: unknown): Customer | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;

	if (typeof raw.id !== 'string' || !UUID_RE.test(raw.id)) return null;
	if (typeof raw.name !== 'string' || !raw.name.trim()) return null;

	return {
		id: raw.id,
		name: raw.name.trim().slice(0, MAX_CUSTOMER_NAME_LENGTH),
		phone: typeof raw.phone === 'string' ? raw.phone.trim().slice(0, MAX_CUSTOMER_PHONE_LENGTH) : '',
		rvType: typeof raw.rvType === 'string' ? raw.rvType.trim().slice(0, MAX_CUSTOMER_RV_TYPE_LENGTH) : '',
		email: typeof raw.email === 'string' ? raw.email.trim().slice(0, MAX_CUSTOMER_EMAIL_LENGTH) : '',
		notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, MAX_CUSTOMER_NOTES_LENGTH) : '',
		createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
		updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
	};
}

function loadFromStorage(): Customer[] {
	if (!browser) return [];

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map(sanitizeCustomer)
			.filter((c): c is Customer => c !== null);
	} catch {
		return [];
	}
}

function saveToStorage(customers: Customer[]): void {
	if (!browser) return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

export function createLocalStorageCustomerRepository(): CustomerRepository {
	let customers = loadFromStorage();

	return {
		getAll(): Customer[] {
			return [...customers];
		},

		getById(id: string): Customer | null {
			return customers.find((c) => c.id === id) ?? null;
		},

		save(customer: Customer): void {
			const next = [...customers];
			const idx = next.findIndex((c) => c.id === customer.id);
			if (idx >= 0) {
				next[idx] = customer;
			} else {
				next.push(customer);
			}
			saveToStorage(next);
			customers = next;
		},

		remove(id: string): void {
			const next = customers.filter((c) => c.id !== id);
			saveToStorage(next);
			customers = next;
		},

		replaceAll(newCustomers: Customer[]): void {
			const next = [...newCustomers];
			saveToStorage(next);
			customers = next;
		}
	};
}
