import { describe, it, expect } from 'vitest';
import { runMigrations, type Migration } from '$lib/infrastructure/storage/sqlite/migrator';
import { allMigrations } from '$lib/infrastructure/storage/sqlite/migrations';
import { createInMemoryDb } from './in-memory-db';

describe('runMigrations', () => {
	it('creates all tables on a fresh database', async () => {
		const db = createInMemoryDb();
		const version = await runMigrations(db, allMigrations);

		expect(version).toBe(5);
		expect(db.tables.has('schema_migrations')).toBe(true);
		expect(db.tables.has('parking_locations')).toBe(true);
		expect(db.tables.has('reservations')).toBe(true);
		expect(db.tables.has('app_metadata')).toBe(true);
		expect(db.tables.has('admin_settings')).toBe(true);
		expect(db.tables.has('customers')).toBe(true);
	});

	it('records the migration version in schema_migrations', async () => {
		const db = createInMemoryDb();
		await runMigrations(db, allMigrations);

		const rows = await db.select<{ version: number }>('SELECT * FROM schema_migrations');
		expect(rows).toHaveLength(5);
		expect(rows[0].version).toBe(1);
		expect(rows[1].version).toBe(2);
		expect(rows[2].version).toBe(3);
		expect(rows[3].version).toBe(4);
		expect(rows[4].version).toBe(5);
	});

	it('is idempotent — re-running does not re-apply migrations', async () => {
		const db = createInMemoryDb();
		await runMigrations(db, allMigrations);
		const version2 = await runMigrations(db, allMigrations);

		expect(version2).toBe(5);
		const rows = await db.select<{ version: number }>('SELECT * FROM schema_migrations');
		expect(rows).toHaveLength(5);
	});

	it('applies only new migrations when database is partially migrated', async () => {
		const db = createInMemoryDb();
		const firstMigration: Migration[] = [allMigrations[0]];
		await runMigrations(db, firstMigration);

		const fakeMigration99: Migration = {
			version: 99,
			async up(d) {
				await d.execute(
					'CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY)'
				);
			}
		};

		const version = await runMigrations(db, [...firstMigration, fakeMigration99]);
		expect(version).toBe(99);
		expect(db.tables.has('test_table')).toBe(true);

		const rows = await db.select<{ version: number }>('SELECT * FROM schema_migrations');
		expect(rows).toHaveLength(2);
	});

	it('returns 0 when no migrations are provided', async () => {
		const db = createInMemoryDb();
		const version = await runMigrations(db, []);
		expect(version).toBe(0);
	});

	it('creates the expected indexes', async () => {
		const db = createInMemoryDb();
		await runMigrations(db, allMigrations);
		expect(db.indexes.has('idx_reservations_location_dates')).toBe(true);
		expect(db.indexes.has('idx_customers_name')).toBe(true);
	});
});
