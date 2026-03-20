import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '$lib/infrastructure/storage/sqlite/migrator';
import { allMigrations } from '$lib/infrastructure/storage/sqlite/migrations';
import { createSqliteAppDataRepository } from '$lib/infrastructure/storage/sqlite/app-data-repository';
import { createSqliteCustomerRepository } from '$lib/infrastructure/storage/sqlite/customer-repository';
import { createSqliteSiteSettingsRepository } from '$lib/infrastructure/storage/sqlite/site-settings-repository';
import { createInMemoryDb } from './in-memory-db';
import * as fs from 'fs';
import * as path from 'path';

describe('backup import through SQLite repos', () => {
	it('imports a real backup file without error', async () => {
		const db = createInMemoryDb();
		await runMigrations(db, allMigrations);

		const appDataRepo = createSqliteAppDataRepository(db);
		const customerRepo = createSqliteCustomerRepository(db);
		const settingsRepo = createSqliteSiteSettingsRepository(db);
		await appDataRepo.init();
		await customerRepo.init();
		await settingsRepo.init();

		const backupPath = path.resolve('./data/rv-backup-2026-03-19_172054.json');
		const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

		const maxIndex = backup.data.reservations.reduce(
			(max: number, r: any) => Math.max(max, r.index), 0
		);

		// This is what importData -> commit -> repo.save() does
		await appDataRepo.save({
			version: 3,
			reservations: backup.data.reservations,
			parkingLocations: backup.data.parkingLocations,
			nextReservationIndex: Math.max(maxIndex + 1, 1),
			lastSavedAt: null
		});

		// Verify data was saved
		const loaded = appDataRepo.load();
		expect(loaded.reservations).toHaveLength(206);
		expect(loaded.parkingLocations).toHaveLength(18);

		// Now test customer replaceAll
		await customerRepo.replaceAll(backup.data.customers);
		expect(customerRepo.getAll()).toHaveLength(168);

		// Test settings
		await settingsRepo.save(backup.data.siteSettings);
		expect(settingsRepo.load().siteName).toBe('RV Park');

		// Verify persistence by creating new repo instances
		const appDataRepo2 = createSqliteAppDataRepository(db);
		await appDataRepo2.init();
		expect(appDataRepo2.load().reservations).toHaveLength(206);

		const customerRepo2 = createSqliteCustomerRepository(db);
		await customerRepo2.init();
		expect(customerRepo2.getAll()).toHaveLength(168);
	});
});
