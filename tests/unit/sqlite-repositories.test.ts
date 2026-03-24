import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runMigrations } from '$lib/infrastructure/storage/sqlite/migrator';
import { allMigrations } from '$lib/infrastructure/storage/sqlite/migrations';
import { createSqliteAppDataRepository } from '$lib/infrastructure/storage/sqlite/app-data-repository';
import { createSqliteSiteSettingsRepository } from '$lib/infrastructure/storage/sqlite/site-settings-repository';
import { createSqliteCustomerRepository } from '$lib/infrastructure/storage/sqlite/customer-repository';
import { createSqliteWriteQueue } from '$lib/infrastructure/storage/sqlite/write-queue';
import type { SqliteWriteQueue } from '$lib/infrastructure/storage/sqlite/write-queue';
import type { PersistedAppData, Reservation } from '$lib/types';
import { createInMemoryDb } from './in-memory-db';
import type { Database } from '$lib/infrastructure/storage/sqlite/types';
import type { Customer } from '$lib/domain/customers';

function createTestQueue(): SqliteWriteQueue {
	return createSqliteWriteQueue((err) => {
		console.error('Test write queue error:', err);
	});
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
	return {
		index: 1,
		firstCellId: 'A-01::2025-03-01',
		name: 'Test Guest',
		phoneNumber: '555-1234',
		notes: 'Some notes',
		startDate: '2025-03-01',
		endDate: '2025-03-05',
		parkingLocation: 'A-01',
		color: 'blue',
		status: 'reserved',
		...overrides
	};
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: 'customer-1',
		name: 'Test Guest',
		phone: '555-1234',
		rvType: '',
		email: '',
		notes: '',
		createdAt: '2025-03-01T00:00:00.000Z',
		updatedAt: '2025-03-01T00:00:00.000Z',
		...overrides
	};
}

function createTransactionGuardDb(): Database {
	let transactionOpen = false;

	return {
		async execute(sql: string): Promise<void> {
			const trimmed = sql.trim();

			if (/^BEGIN/i.test(trimmed)) {
				if (transactionOpen) {
					throw new Error('concurrent transaction detected');
				}
				transactionOpen = true;
				await new Promise((resolve) => setTimeout(resolve, 10));
				return;
			}

			if (/^COMMIT/i.test(trimmed) || /^ROLLBACK/i.test(trimmed)) {
				transactionOpen = false;
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, 1));
		},

		async select<T>(): Promise<T[]> {
			return [];
		}
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('SQLite write queue', () => {
	it('flush rejects on a failed write and still allows later writes to proceed', async () => {
		const errors: unknown[] = [];
		const queue = createSqliteWriteQueue((error) => {
			errors.push(error);
		});

		queue.enqueue(async () => {
			throw new Error('disk write failed');
		});

		await expect(queue.flush()).rejects.toThrow('disk write failed');
		expect(errors).toHaveLength(1);

		queue.enqueue(async () => undefined);

		await expect(queue.flush()).resolves.toBeUndefined();
		expect(errors).toHaveLength(1);
	});
});

describe('SQLite AppDataRepository', () => {
	let db: ReturnType<typeof createInMemoryDb>;

	beforeEach(async () => {
		db = createInMemoryDb();
		await runMigrations(db, allMigrations);
	});

	it('returns default data on empty database', async () => {
		const repo = createSqliteAppDataRepository(db, createTestQueue());
		await repo.init();
		const data = repo.load();

		expect(data.version).toBe(3);
		expect(data.reservations).toEqual([]);
		expect(data.parkingLocations).toHaveLength(10);
		expect(data.parkingLocations[0]).toBe('A-01');
		expect(data.nextReservationIndex).toBe(1);
	});

	it('round-trips reservations through save and reload', async () => {
		const repo = createSqliteAppDataRepository(db, createTestQueue());
		await repo.init();

		const data: PersistedAppData = {
			version: 3,
			reservations: [
				makeReservation({ index: 1 }),
				makeReservation({ index: 2, name: 'Another Guest', startDate: '2025-04-01', endDate: '2025-04-03', firstCellId: 'A-01::2025-04-01' })
			],
			parkingLocations: ['A-01', 'B-01'],
			nextReservationIndex: 3,
			lastSavedAt: null
		};

		repo.save(data);

		// Wait for async write to complete
		await repo.flush();

		// Create a new repo instance to verify persistence
		const repo2 = createSqliteAppDataRepository(db, createTestQueue());
		await repo2.init();
		const loaded = repo2.load();

		expect(loaded.reservations).toHaveLength(2);
		expect(loaded.reservations[0].name).toBe('Test Guest');
		expect(loaded.reservations[1].name).toBe('Another Guest');
		expect(loaded.parkingLocations).toEqual(['A-01', 'B-01']);
		expect(loaded.nextReservationIndex).toBe(3);
	});

	it('preserves parking location order', async () => {
		const repo = createSqliteAppDataRepository(db, createTestQueue());
		await repo.init();

		const data: PersistedAppData = {
			version: 3,
			reservations: [],
			parkingLocations: ['Z-99', 'A-01', 'M-50'],
			nextReservationIndex: 1,
			lastSavedAt: null
		};

		repo.save(data);
		await repo.flush();

		const repo2 = createSqliteAppDataRepository(db, createTestQueue());
		await repo2.init();
		expect(repo2.load().parkingLocations).toEqual(['Z-99', 'A-01', 'M-50']);
	});

	it('clear resets to default state', async () => {
		const repo = createSqliteAppDataRepository(db, createTestQueue());
		await repo.init();

		repo.save({
			version: 3,
			reservations: [makeReservation()],
			parkingLocations: ['A-01'],
			nextReservationIndex: 5,
			lastSavedAt: null
		});
		await repo.flush();

		repo.clear();
		await repo.flush();

		const repo2 = createSqliteAppDataRepository(db, createTestQueue());
		await repo2.init();
		const data = repo2.load();

		expect(data.reservations).toEqual([]);
		expect(data.parkingLocations).toHaveLength(10);
		expect(data.nextReservationIndex).toBe(1);
	});

	it('getDefaultData returns correct defaults', async () => {
		const repo = createSqliteAppDataRepository(db, createTestQueue());
		const defaults = repo.getDefaultData();

		expect(defaults.version).toBe(3);
		expect(defaults.reservations).toEqual([]);
		expect(defaults.parkingLocations).toHaveLength(10);
		expect(defaults.nextReservationIndex).toBe(1);
		expect(defaults.lastSavedAt).toBeNull();
	});

	it('serializes rapid successive saves instead of opening concurrent transactions', async () => {
		const guardedDb = createTransactionGuardDb();
		const repo = createSqliteAppDataRepository(guardedDb, createTestQueue());
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await repo.init();

		repo.save({
			version: 3,
			reservations: [makeReservation({ index: 1 })],
			parkingLocations: ['A-01'],
			nextReservationIndex: 2,
			lastSavedAt: null
		});
		repo.save({
			version: 3,
			reservations: [makeReservation({ index: 2, firstCellId: 'A-01::2025-04-01', startDate: '2025-04-01', endDate: '2025-04-02' })],
			parkingLocations: ['A-01'],
			nextReservationIndex: 3,
			lastSavedAt: null
		});

		await repo.flush();

		expect(errorSpy).not.toHaveBeenCalled();
	});

	it('persists reservations with customer references after queued customer writes', async () => {
		const writes = createTestQueue();
		const appRepo = createSqliteAppDataRepository(db, writes);
		const customerRepo = createSqliteCustomerRepository(db, writes);

		await appRepo.init();
		await customerRepo.init();

		customerRepo.replaceAll([makeCustomer({ id: 'linked-customer' })]);
		appRepo.save({
			version: 3,
			reservations: [
				makeReservation({
					customerId: 'linked-customer'
				})
			],
			parkingLocations: ['A-01'],
			nextReservationIndex: 2,
			lastSavedAt: null
		});

		await appRepo.flush();

		const reloadedRepo = createSqliteAppDataRepository(db, createTestQueue());
		await reloadedRepo.init();
		expect(reloadedRepo.load().reservations[0].customerId).toBe('linked-customer');
	});
});

describe('SQLite SiteSettingsRepository', () => {
	let db: ReturnType<typeof createInMemoryDb>;

	beforeEach(async () => {
		db = createInMemoryDb();
		await runMigrations(db, allMigrations);
	});

	it('returns default settings on empty database', async () => {
		const repo = createSqliteSiteSettingsRepository(db, createTestQueue());
		await repo.init();
		const settings = repo.load();

		expect(settings.siteName).toBe('RV Reservation Schedule');
		expect(settings.compactView).toBe(false);
	});

	it('round-trips settings through save and reload', async () => {
		const repo = createSqliteSiteSettingsRepository(db, createTestQueue());
		await repo.init();

		repo.save({ siteName: 'My Park', compactView: true });
		await new Promise((r) => setTimeout(r, 10));

		const repo2 = createSqliteSiteSettingsRepository(db, createTestQueue());
		await repo2.init();
		const loaded = repo2.load();

		expect(loaded.siteName).toBe('My Park');
		expect(loaded.compactView).toBe(true);
	});

	it('sanitizes settings on save', async () => {
		const repo = createSqliteSiteSettingsRepository(db, createTestQueue());
		await repo.init();

		const result = repo.save({ siteName: '  Padded Name  ' });
		expect(result.siteName).toBe('Padded Name');
	});

	it('enforces max lengths', async () => {
		const repo = createSqliteSiteSettingsRepository(db, createTestQueue());
		await repo.init();

		const result = repo.save({
			siteName: 'A'.repeat(100)
		});

		expect(result.siteName).toHaveLength(80);
	});

	it('flushes pending settings writes before reload', async () => {
		const repo = createSqliteSiteSettingsRepository(db, createTestQueue());
		await repo.init();

		repo.save({ siteName: 'My Park' });
		await repo.flush();

		const repo2 = createSqliteSiteSettingsRepository(db, createTestQueue());
		await repo2.init();

		expect(repo2.load().siteName).toBe('My Park');
	});
});

describe('SQLite CustomerRepository', () => {
	let db: ReturnType<typeof createInMemoryDb>;

	beforeEach(async () => {
		db = createInMemoryDb();
		await runMigrations(db, allMigrations);
	});

	it('returns no customers on an empty database', async () => {
		const repo = createSqliteCustomerRepository(db, createTestQueue());
		await repo.init();

		expect(repo.getAll()).toEqual([]);
	});

	it('flushes pending customer writes before reload', async () => {
		const repo = createSqliteCustomerRepository(db, createTestQueue());
		await repo.init();

		repo.save(makeCustomer());
		await repo.flush();

		const repo2 = createSqliteCustomerRepository(db, createTestQueue());
		await repo2.init();

		expect(repo2.getAll()).toEqual([makeCustomer()]);
	});
});
