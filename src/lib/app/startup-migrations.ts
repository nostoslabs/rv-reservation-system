import type { AppServices } from './composition';

const DEDUP_FLAG = 'rv-reservation-demo:migrations:dedup-v1';

export function runStartupMigrations(_services: AppServices): void {
	// Disabled: the auto-dedup was causing data loss when saveToDb's transaction
	// rolled back but the in-memory cache was already updated. On next restart,
	// init() would load the rolled-back (empty) DB state.
	// TODO: fix the cache/DB consistency issue before re-enabling.
}
