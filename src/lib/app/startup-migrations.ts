import type { AppServices } from './composition';

const DEDUP_FLAG = 'rv-reservation-demo:migrations:dedup-v1';

export function runStartupMigrations(services: AppServices): void {
	if (typeof localStorage === 'undefined') return;

	if (!localStorage.getItem(DEDUP_FLAG)) {
		const appData = services.repositories.appData.load();
		const result = services.mergeCustomersUseCases.deduplicateAll(appData);
		if (result.groupsMerged > 0) {
			services.repositories.appData.save(result.data);
		}
		localStorage.setItem(DEDUP_FLAG, new Date().toISOString());
	}
}
