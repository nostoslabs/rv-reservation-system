/**
 * Minimal database interface expected by the SQLite storage layer.
 * Abstracts over the concrete driver (Tauri SQL plugin, better-sqlite3, etc.)
 * so the repository code is testable without a real database.
 */
export interface Database {
	execute(sql: string, params?: unknown[]): Promise<void>;
	select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export async function withTransaction<T>(db: Database, fn: () => Promise<T>): Promise<T> {
	await db.execute('BEGIN TRANSACTION');
	try {
		const result = await fn();
		await db.execute('COMMIT');
		return result;
	} catch (err) {
		await db.execute('ROLLBACK').catch(() => {});
		throw err;
	}
}
