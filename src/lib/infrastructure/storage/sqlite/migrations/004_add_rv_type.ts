import type { Database } from '../types';

export const version = 4;

export async function up(db: Database): Promise<void> {
	await db.execute(`
		ALTER TABLE customers ADD COLUMN rv_type TEXT NOT NULL DEFAULT ''
	`);
}
