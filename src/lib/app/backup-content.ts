import { get } from 'svelte/store';
import { createBackup } from '$lib/domain/backup';
import { customerStore } from '$lib/customer-state';
import { rvReservationStore } from '$lib/state';
import { siteSettingsStore } from '$lib/site-settings';

export function createCurrentBackupContent(): string {
	const state = get(rvReservationStore);
	const settings = get(siteSettingsStore);
	const customers = customerStore.getAll();
	const backup = createBackup(state.reservations, state.parkingLocations, settings, customers);
	return JSON.stringify(backup, null, 2);
}
