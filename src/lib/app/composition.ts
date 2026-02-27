import type { StorageRepositories } from '$lib/application/ports';
import {
	createReservationUseCases,
	createParkingLocationUseCases,
	type ReservationUseCases,
	type ParkingLocationUseCases
} from '$lib/application/use-cases';
import { createLocalStorageAppDataRepository } from '$lib/infrastructure/storage/localstorage/app-data-repository';
import { createLocalStorageSiteSettingsRepository } from '$lib/infrastructure/storage/localstorage/site-settings-repository';

export interface AppServices {
	repositories: StorageRepositories;
	reservationUseCases: ReservationUseCases;
	parkingLocationUseCases: ParkingLocationUseCases;
}

let instance: AppServices | null = null;

function createLocalStorageServices(): AppServices {
	const appDataRepo = createLocalStorageAppDataRepository();
	const siteSettingsRepo = createLocalStorageSiteSettingsRepository();

	const repositories: StorageRepositories = {
		appData: appDataRepo,
		siteSettings: siteSettingsRepo
	};

	return {
		repositories,
		reservationUseCases: createReservationUseCases(appDataRepo),
		parkingLocationUseCases: createParkingLocationUseCases(appDataRepo)
	};
}

/**
 * Get the application services singleton.
 * Currently wires LocalStorage repositories; swap this function body
 * to use SQLite/Tauri repositories for the desktop build.
 */
export function getAppServices(): AppServices {
	if (!instance) {
		instance = createLocalStorageServices();
	}
	return instance;
}
