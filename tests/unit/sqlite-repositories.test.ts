import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runMigrations } from '$lib/infrastructure/storage/sqlite/migrator';
import { allMigrations } from '$lib/infrastructure/storage/sqlite/migrations';
import { createSqliteAppDataRepository } from '$lib/infrastructure/storage/sqlite/app-data-repository';
import { createSqliteSiteSettingsRepository } from '$lib/infrastructure/storage/sqlite/site-settings-repository';
import { createSqliteCustomerRepository } from '$lib/infrastructure/storage/sqlite/customer-repository';
import type { PersistedAppData, Reservation } from '$lib/types';
import { createInMemoryDb } from './in-memory-db';
import type { Customer } from '$lib/domain/customers';

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
		email: '',
		notes: '',
		createdAt: '2025-03-01T00:00:00.000Z',
		updatedAt: '2025-03-01T00:00:00.000Z',
		...overrides
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('SQLite AppDataRepository', () => {
	let db: ReturnType<typeof createInMemoryDb>;

	beforeEach(async () => {
		db = createInMemoryDb();
		await runMigrations(db, allMigrations);
	});

	it('returns default data on empty database', async () => {
		const repo = createSqliteAppDataRepository(db);
		await repo.init();
		const data = repo.load();

		expect(data.version).toBe(3);
		expect(data.reservations).toEqual([]);
		expect(data.parkingLocations).toHaveLength(10);
		expect(data.parkingLocations[0]).toBe('A-01');
		expect(data.nextReservationIndex).toBe(1);
	});

	it('round-trips reservations through save and reload', async () => {
		const repo = createSqliteAppDataRepository(db);
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

		await repo.save(data);

		// Create a new repo instance to verify persistence
		const repo2 = createSqliteAppDataRepository(db);
		await repo2.init();
		const loaded = repo2.load();

		expect(loaded.reservations).toHaveLength(2);
		expect(loaded.reservations[0].name).toBe('Test Guest');
		expect(loaded.reservations[1].name).toBe('Another Guest');
		expect(loaded.parkingLocations).toEqual(['A-01', 'B-01']);
		expect(loaded.nextReservationIndex).toBe(3);
	});

	it('preserves parking location order', async () => {
		const repo = createSqliteAppDataRepository(db);
		await repo.init();

		const data: PersistedAppData = {
			version: 3,
			reservations: [],
			parkingLocations: ['Z-99', 'A-01', 'M-50'],
			nextReservationIndex: 1,
			lastSavedAt: null
		};

		await repo.save(data);

		const repo2 = createSqliteAppDataRepository(db);
		await repo2.init();
		expect(repo2.load().parkingLocations).toEqual(['Z-99', 'A-01', 'M-50']);
	});

	it('clear resets to default state', async () => {
		const repo = createSqliteAppDataRepository(db);
		await repo.init();

		await repo.save({
			version: 3,
			reservations: [makeReservation()],
			parkingLocations: ['A-01'],
			nextReservationIndex: 5,
			lastSavedAt: null
		});

		await repo.clear();

		const repo2 = createSqliteAppDataRepository(db);
		await repo2.init();
		const data = repo2.load();

		expect(data.reservations).toEqual([]);
		expect(data.parkingLocations).toHaveLength(10);
		expect(data.nextReservationIndex).toBe(1);
	});

	it('getDefaultData returns correct defaults', async () => {
		const repo = createSqliteAppDataRepository(db);
		const defaults = repo.getDefaultData();

		expect(defaults.version).toBe(3);
		expect(defaults.reservations).toEqual([]);
		expect(defaults.parkingLocations).toHaveLength(10);
		expect(defaults.nextReservationIndex).toBe(1);
		expect(defaults.lastSavedAt).toBeNull();
	});

	it('upsert pattern preserves existing data when adding new records', async () => {
		const repo = createSqliteAppDataRepository(db);
		await repo.init();

		// Save initial data
		await repo.save({
			version: 3,
			reservations: [makeReservation({ index: 1 })],
			parkingLocations: ['A-01'],
			nextReservationIndex: 2,
			lastSavedAt: null
		});

		// Save updated data with additional reservation
		await repo.save({
			version: 3,
			reservations: [
				makeReservation({ index: 1 }),
				makeReservation({ index: 2, firstCellId: 'A-01::2025-04-01', startDate: '2025-04-01', endDate: '2025-04-02' })
			],
			parkingLocations: ['A-01'],
			nextReservationIndex: 3,
			lastSavedAt: null
		});

		const repo2 = createSqliteAppDataRepository(db);
		await repo2.init();
		expect(repo2.load().reservations).toHaveLength(2);
	});
});

describe('SQLite SiteSettingsRepository', () => {
	let db: ReturnType<typeof createInMemoryDb>;

	beforeEach(async () => {
		db = createInMemoryDb();
		await runMigrations(db, allMigrations);
	});

	it('returns default settings on empty database', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();
		const settings = repo.load();

		expect(settings.siteName).toBe('RV Reservation Schedule');
	});

	it('round-trips settings through save and reload', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();

		await repo.save({ siteName: 'My Park' });

		const repo2 = createSqliteSiteSettingsRepository(db);
		await repo2.init();
		const loaded = repo2.load();

		expect(loaded.siteName).toBe('My Park');
	});

	it('sanitizes settings on save', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();

		const result = await repo.save({ siteName: '  Padded Name  ' });
		expect(result.siteName).toBe('Padded Name');
	});

	it('enforces max lengths', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();

		const result = await repo.save({
			siteName: 'A'.repeat(100)
		});

		expect(result.siteName).toHaveLength(80);
	});

	it('persists settings across repo instances', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();

		await repo.save({ siteName: 'My Park' });

		const repo2 = createSqliteSiteSettingsRepository(db);
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
		const repo = createSqliteCustomerRepository(db);
		await repo.init();

		expect(repo.getAll()).toEqual([]);
	});

	it('persists customer writes across repo instances', async () => {
		const repo = createSqliteCustomerRepository(db);
		await repo.init();

		await repo.save(makeCustomer());

		const repo2 = createSqliteCustomerRepository(db);
		await repo2.init();

		expect(repo2.getAll()).toEqual([makeCustomer()]);
	});
});
