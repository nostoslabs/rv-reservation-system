import type { Database } from '../types';

export const version = 4;

async function hasColumn(db: Database, table: string, column: string): Promise<boolean> {
	const rows = await db.select<{ name: string }>(`PRAGMA table_info(${table})`);
	return rows.some((r) => r.name === column);
}

export async function up(db: Database): Promise<void> {
	if (!(await hasColumn(db, 'customers', 'rv_type'))) {
		await db.execute(`
			ALTER TABLE customers ADD COLUMN rv_type TEXT NOT NULL DEFAULT ''
		`);
	}
	if (!(await hasColumn(db, 'reservations', 'rv_type'))) {
		await db.execute(`
			ALTER TABLE reservations ADD COLUMN rv_type TEXT NOT NULL DEFAULT ''
		`);
	}
}
