import type { Database } from './types';

export interface Migration {
	version: number;
	up(db: Database): Promise<void>;
}

/**
 * Ensure the schema_migrations table exists so we can track versions.
 */
async function ensureMigrationsTable(db: Database): Promise<void> {
	await db.execute(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);
}

/**
 * Return the highest migration version that has been applied, or 0 if none.
 */
async function getCurrentVersion(db: Database): Promise<number> {
	const rows = await db.select<{ version: number }>(
		'SELECT MAX(version) AS version FROM schema_migrations'
	);
	return rows[0]?.version ?? 0;
}

/**
 * Run all pending migrations in order.
 * Migrations whose version is <= the current DB version are skipped.
 * Returns the new current version after applying migrations.
 */
export async function runMigrations(db: Database, migrations: Migration[]): Promise<number> {
	await ensureMigrationsTable(db);
	const current = await getCurrentVersion(db);

	const pending = migrations
		.filter((m) => m.version > current)
		.sort((a, b) => a.version - b.version);

	for (const migration of pending) {
		await migration.up(db);
		await db.execute('INSERT INTO schema_migrations (version) VALUES (?)', [migration.version]);
	}

	return pending.length > 0 ? pending[pending.length - 1].version : current;
}
