import { describe, it, expect } from 'vitest';
import { runMigrations, type Migration } from '$lib/infrastructure/storage/sqlite/migrator';
import { allMigrations } from '$lib/infrastructure/storage/sqlite/migrations';
import { createInMemoryDb } from './in-memory-db';

describe('runMigrations', () => {
	it('creates all tables on a fresh database', async () => {
		const db = createInMemoryDb();
		const version = await runMigrations(db, allMigrations);

		expect(version).toBe(6);
		expect(db.tables.has('schema_migrations')).toBe(true);
		expect(db.tables.has('parking_locations')).toBe(true);
		expect(db.tables.has('reservations')).toBe(true);
		expect(db.tables.has('app_metadata')).toBe(true);
		expect(db.tables.has('admin_settings')).toBe(true);
		expect(db.tables.has('customers')).toBe(true);
		const reservationColumns = await db.select<{ name: string }>('PRAGMA table_info(reservations)');
		expect(reservationColumns.map((column) => column.name)).toEqual(
			expect.arrayContaining(['rv_type', 'eta', 'created_at', 'customer_id'])
		);
	});

	it('records the migration version in schema_migrations', async () => {
		const db = createInMemoryDb();
		await runMigrations(db, allMigrations);

		const rows = await db.select<{ version: number }>('SELECT * FROM schema_migrations');
		expect(rows).toHaveLength(6);
		expect(rows.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('is idempotent — re-running does not re-apply migrations', async () => {
		const db = createInMemoryDb();
		await runMigrations(db, allMigrations);
		const version2 = await runMigrations(db, allMigrations);

		expect(version2).toBe(6);
		const rows = await db.select<{ version: number }>('SELECT * FROM schema_migrations');
		expect(rows).toHaveLength(6);
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
