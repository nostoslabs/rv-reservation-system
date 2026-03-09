import type { Database } from '../types';

export const version = 2;

export async function up(db: Database): Promise<void> {
	await db.execute(`
		ALTER TABLE reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'reserved'
	`);
}
