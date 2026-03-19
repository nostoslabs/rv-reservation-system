import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runStartupMigrations } from '$lib/app/startup-migrations';
import type { AppServices } from '$lib/app/composition';
import type { Customer } from '$lib/domain/customers';
import type { PersistedAppData } from '$lib/types';
import { createMergeCustomersUseCases } from '$lib/application/use-cases/merge-customers-use-case';
import type { CustomerRepository } from '$lib/application/ports/customer';

// Mock localStorage for Node test environment
const storage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => { storage.set(key, value); },
	removeItem: (key: string) => { storage.delete(key); },
	clear: () => { storage.clear(); },
	get length() { return storage.size; },
	key: (index: number) => Array.from(storage.keys())[index] ?? null
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

function createInMemoryCustomerRepository(): CustomerRepository {
	let customers: Customer[] = [];
	return {
		getAll() { return [...customers]; },
		getById(id: string) { return customers.find((c) => c.id === id) ?? null; },
		save(customer: Customer) {
			const idx = customers.findIndex((c) => c.id === customer.id);
			if (idx >= 0) { customers[idx] = customer; } else { customers.push(customer); }
		},
		remove(id: string) { customers = customers.filter((c) => c.id !== id); },
		replaceAll(newCustomers: Customer[]) { customers = [...newCustomers]; }
	};
}

const DEDUP_FLAG = 'rv-reservation-demo:migrations:dedup-v1';

function makeAppData(): PersistedAppData {
	return {
		version: 1,
		reservations: [],
		parkingLocations: [],
		nextReservationIndex: 1,
		lastSavedAt: null
	};
}

function makeServices(repo: CustomerRepository, appData: PersistedAppData): AppServices {
	return {
		desktop: { isDesktop: false, getAppDataDir: async () => null },
		repositories: {
			appData: {
				getDefaultData: () => makeAppData(),
				load: () => appData,
				save: vi.fn().mockReturnValue(Date.now()),
				clear: vi.fn()
			},
			siteSettings: {
				load: () => ({ siteName: 'Test' }),
				save: vi.fn()
			},
			customers: repo
		},
		reservationUseCases: {} as any,
		parkingLocationUseCases: {} as any,
		adminSettingsUseCases: {} as any,
		customerUseCases: {} as any,
		mergeCustomersUseCases: createMergeCustomersUseCases(repo)
	};
}

describe('runStartupMigrations', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('runs dedup when duplicates exist and persists results', () => {
		const repo = createInMemoryCustomerRepository();
		const a: Customer = {
			id: 'a', name: 'John Smith', phone: '555-1234',
			email: '', notes: '',
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z'
		};
		const b: Customer = {
			id: 'b', name: 'John Smith', phone: '555-1234',
			email: '', notes: '',
			createdAt: '2025-06-01T00:00:00.000Z',
			updatedAt: '2025-06-01T00:00:00.000Z'
		};
		repo.save(a);
		repo.save(b);

		const appData = makeAppData();
		const services = makeServices(repo, appData);

		runStartupMigrations(services);

		expect(repo.getAll()).toHaveLength(1);
		expect(services.repositories.appData.save).toHaveBeenCalled();
		expect(localStorage.getItem(DEDUP_FLAG)).not.toBeNull();
	});

	it('no-op on second call (flag set)', () => {
		const repo = createInMemoryCustomerRepository();
		const a: Customer = {
			id: 'a', name: 'John Smith', phone: '555-1234',
			email: '', notes: '',
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z'
		};
		const b: Customer = {
			id: 'b', name: 'John Smith', phone: '555-1234',
			email: '', notes: '',
			createdAt: '2025-06-01T00:00:00.000Z',
			updatedAt: '2025-06-01T00:00:00.000Z'
		};
		repo.save(a);
		repo.save(b);

		const appData = makeAppData();
		const services = makeServices(repo, appData);

		runStartupMigrations(services);
		expect(repo.getAll()).toHaveLength(1);

		// Add duplicates again
		repo.save(a);
		repo.save({ ...b, id: 'c' });

		// Second call — flag is set, should not dedup
		runStartupMigrations(services);
		expect(repo.getAll()).toHaveLength(3);
	});

	it('sets flag even when no duplicates found', () => {
		const repo = createInMemoryCustomerRepository();
		const a: Customer = {
			id: 'a', name: 'Alice', phone: '111',
			email: '', notes: '',
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z'
		};
		repo.save(a);

		const appData = makeAppData();
		const services = makeServices(repo, appData);

		runStartupMigrations(services);

		expect(localStorage.getItem(DEDUP_FLAG)).not.toBeNull();
		expect(services.repositories.appData.save).not.toHaveBeenCalled();
	});
});
