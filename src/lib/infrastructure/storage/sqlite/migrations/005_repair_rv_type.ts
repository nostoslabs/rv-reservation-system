import type { Database } from '../types';

export const version = 5;

/**
 * Repair: migration 004 may have recorded success after adding rv_type
 * to the customers table but before adding it to the reservations table.
 * This ensures the column exists on both tables.
 */
export async function up(db: Database): Promise<void> {
	const rows = await db.select<{ name: string }>('PRAGMA table_info(reservations)');
	const hasRvType = rows.some((r) => r.name === 'rv_type');
	if (!hasRvType) {
		await db.execute(`
			ALTER TABLE reservations ADD COLUMN rv_type TEXT NOT NULL DEFAULT ''
		`);
	}
}
