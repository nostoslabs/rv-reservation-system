import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '$lib/infrastructure/storage/sqlite/migrator';
import { allMigrations } from '$lib/infrastructure/storage/sqlite/migrations';
import { createSqliteAppDataRepository } from '$lib/infrastructure/storage/sqlite/app-data-repository';
import { createSqliteSiteSettingsRepository } from '$lib/infrastructure/storage/sqlite/site-settings-repository';
import type { PersistedAppData, Reservation } from '$lib/types';
import { createInMemoryDb } from './in-memory-db';

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
		...overrides
	};
}

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

		expect(data.version).toBe(2);
		expect(data.reservations).toEqual([]);
		expect(data.parkingLocations).toHaveLength(10);
		expect(data.parkingLocations[0]).toBe('A-01');
		expect(data.nextReservationIndex).toBe(1);
	});

	it('round-trips reservations through save and reload', async () => {
		const repo = createSqliteAppDataRepository(db);
		await repo.init();

		const data: PersistedAppData = {
			version: 2,
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
		await new Promise((r) => setTimeout(r, 10));

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
			version: 2,
			reservations: [],
			parkingLocations: ['Z-99', 'A-01', 'M-50'],
			nextReservationIndex: 1,
			lastSavedAt: null
		};

		repo.save(data);
		await new Promise((r) => setTimeout(r, 10));

		const repo2 = createSqliteAppDataRepository(db);
		await repo2.init();
		expect(repo2.load().parkingLocations).toEqual(['Z-99', 'A-01', 'M-50']);
	});

	it('clear resets to default state', async () => {
		const repo = createSqliteAppDataRepository(db);
		await repo.init();

		repo.save({
			version: 2,
			reservations: [makeReservation()],
			parkingLocations: ['A-01'],
			nextReservationIndex: 5,
			lastSavedAt: null
		});
		await new Promise((r) => setTimeout(r, 10));

		repo.clear();
		await new Promise((r) => setTimeout(r, 10));

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

		expect(defaults.version).toBe(2);
		expect(defaults.reservations).toEqual([]);
		expect(defaults.parkingLocations).toHaveLength(10);
		expect(defaults.nextReservationIndex).toBe(1);
		expect(defaults.lastSavedAt).toBeNull();
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
		expect(settings.adminPasscode).toBe('');
	});

	it('round-trips settings through save and reload', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();

		repo.save({ siteName: 'My Park', adminPasscode: '1234' });
		await new Promise((r) => setTimeout(r, 10));

		const repo2 = createSqliteSiteSettingsRepository(db);
		await repo2.init();
		const loaded = repo2.load();

		expect(loaded.siteName).toBe('My Park');
		expect(loaded.adminPasscode).toBe('1234');
	});

	it('sanitizes settings on save', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();

		const result = repo.save({ siteName: '  Padded Name  ', adminPasscode: '  pass  ' });
		expect(result.siteName).toBe('Padded Name');
		expect(result.adminPasscode).toBe('pass');
	});

	it('enforces max lengths', async () => {
		const repo = createSqliteSiteSettingsRepository(db);
		await repo.init();

		const result = repo.save({
			siteName: 'A'.repeat(100),
			adminPasscode: 'B'.repeat(100)
		});

		expect(result.siteName).toHaveLength(80);
		expect(result.adminPasscode).toHaveLength(64);
	});
});
