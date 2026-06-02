import type { Database } from '../types';

export const version = 6;

async function hasColumn(db: Database, table: string, column: string): Promise<boolean> {
	const rows = await db.select<{ name: string }>(`PRAGMA table_info(${table})`);
	return rows.some((r) => r.name === column);
}

export async function up(db: Database): Promise<void> {
	if (!(await hasColumn(db, 'reservations', 'eta'))) {
		await db.execute(`
			ALTER TABLE reservations ADD COLUMN eta TEXT NOT NULL DEFAULT ''
		`);
	}

	if (!(await hasColumn(db, 'reservations', 'created_at'))) {
		await db.execute(`
			ALTER TABLE reservations ADD COLUMN created_at TEXT NOT NULL DEFAULT ''
		`);
		await db.execute(`
			UPDATE reservations SET created_at = start_date WHERE created_at = ''
		`);
	}
}
