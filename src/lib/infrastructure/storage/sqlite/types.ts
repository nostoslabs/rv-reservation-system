/**
 * Minimal database interface expected by the SQLite storage layer.
 * Abstracts over the concrete driver (Tauri SQL plugin, better-sqlite3, etc.)
 * so the repository code is testable without a real database.
 */
export interface Database {
	execute(sql: string, params?: unknown[]): Promise<void>;
	select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
