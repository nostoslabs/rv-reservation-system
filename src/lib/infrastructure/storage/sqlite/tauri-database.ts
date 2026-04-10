import type { Database } from './types';

/**
 * Create a Database adapter backed by the Tauri SQL plugin.
 * Dynamically imports @tauri-apps/plugin-sql so this module
 * is safe to reference from web builds (it just won't be called).
 */
export async function createTauriDatabase(path: string): Promise<Database> {
	const { default: TauriDatabase } = await import('@tauri-apps/plugin-sql');
	const db = await TauriDatabase.load(`sqlite:${path}`);

	// Enable WAL journal mode for crash resilience. In WAL mode, SQLite never
	// modifies the main database file during a transaction — it appends to a
	// write-ahead log. If the app is killed mid-transaction, the database
	// remains intact with the pre-transaction data.
	await db.execute('PRAGMA journal_mode=WAL');

	return {
		async execute(sql: string, params: unknown[] = []): Promise<void> {
			await db.execute(sql, params);
		},
		async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
			return db.select<T[]>(sql, params);
		}
	};
}
