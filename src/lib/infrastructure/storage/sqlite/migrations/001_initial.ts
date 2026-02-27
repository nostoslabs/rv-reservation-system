import type { Database } from '../types';

export const version = 1;

export async function up(db: Database): Promise<void> {
	await db.execute(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS parking_locations (
			name       TEXT PRIMARY KEY,
			sort_order INTEGER NOT NULL
		)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS reservations (
			id               INTEGER PRIMARY KEY,
			name             TEXT    NOT NULL,
			phone_number     TEXT    NOT NULL DEFAULT '',
			notes            TEXT    NOT NULL DEFAULT '',
			start_date       TEXT    NOT NULL,
			end_date         TEXT    NOT NULL,
			parking_location TEXT    NOT NULL REFERENCES parking_locations(name),
			color            TEXT    NOT NULL DEFAULT 'blue',
			CHECK (start_date < end_date),
			CHECK (color IN ('red','green','blue','yellow','pink','orange','purple'))
		)
	`);

	await db.execute(`
		CREATE INDEX IF NOT EXISTS idx_reservations_location_dates
			ON reservations(parking_location, start_date, end_date)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS app_metadata (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS admin_settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`);
}
