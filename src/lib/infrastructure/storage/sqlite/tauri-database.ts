import type { Database } from './types';

/**
 * Create a Database adapter backed by the Tauri SQL plugin.
 * Dynamically imports @tauri-apps/plugin-sql so this module
 * is safe to reference from web builds (it just won't be called).
 */
export async function createTauriDatabase(path: string): Promise<Database> {
	const { default: TauriDatabase } = await import('@tauri-apps/plugin-sql');
	const db = await TauriDatabase.load(`sqlite:${path}`);

	return {
		async execute(sql: string, params: unknown[] = []): Promise<void> {
			await db.execute(sql, params);
		},
		async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
			return db.select<T[]>(sql, params);
		}
	};
}
