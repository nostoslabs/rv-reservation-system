import type { Database } from '../types';

export const version = 3;

export async function up(db: Database): Promise<void> {
	await db.execute(`
		CREATE TABLE customers (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			phone      TEXT NOT NULL DEFAULT '',
			email      TEXT NOT NULL DEFAULT '',
			notes      TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	await db.execute(`
		CREATE INDEX idx_customers_name ON customers(name)
	`);

	await db.execute(`
		ALTER TABLE reservations ADD COLUMN customer_id TEXT REFERENCES customers(id)
	`);
}
