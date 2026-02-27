import type { DesktopCapabilities, StorageRepositories } from '$lib/application/ports';
import {
	createReservationUseCases,
	createParkingLocationUseCases,
	createAdminSettingsUseCases,
	type ReservationUseCases,
	type ParkingLocationUseCases,
	type AdminSettingsUseCases
} from '$lib/application/use-cases';
import { createWebFallbackDesktopCapabilities } from '$lib/infrastructure/desktop/web-fallback';
import { createLocalStorageAppDataRepository } from '$lib/infrastructure/storage/localstorage/app-data-repository';
import { createLocalStorageSiteSettingsRepository } from '$lib/infrastructure/storage/localstorage/site-settings-repository';

export interface AppServices {
	desktop: DesktopCapabilities;
	repositories: StorageRepositories;
	reservationUseCases: ReservationUseCases;
	parkingLocationUseCases: ParkingLocationUseCases;
	adminSettingsUseCases: AdminSettingsUseCases;
}

let instance: AppServices | null = null;
let initPromise: Promise<AppServices> | null = null;

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function createLocalStorageServices(): AppServices {
	const appDataRepo = createLocalStorageAppDataRepository();
	const siteSettingsRepo = createLocalStorageSiteSettingsRepository();

	const repositories: StorageRepositories = {
		appData: appDataRepo,
		siteSettings: siteSettingsRepo
	};

	return {
		desktop: createWebFallbackDesktopCapabilities(),
		repositories,
		reservationUseCases: createReservationUseCases(appDataRepo),
		parkingLocationUseCases: createParkingLocationUseCases(appDataRepo),
		adminSettingsUseCases: createAdminSettingsUseCases(siteSettingsRepo)
	};
}

async function createSqliteServices(): Promise<AppServices> {
	const { createTauriDesktopCapabilities } = await import(
		'$lib/infrastructure/desktop/tauri-capabilities'
	);
	const { createTauriDatabase } = await import(
		'$lib/infrastructure/storage/sqlite/tauri-database'
	);
	const { createSqliteAppDataRepository } = await import(
		'$lib/infrastructure/storage/sqlite/app-data-repository'
	);
	const { createSqliteSiteSettingsRepository } = await import(
		'$lib/infrastructure/storage/sqlite/site-settings-repository'
	);
	const { runMigrations } = await import('$lib/infrastructure/storage/sqlite/migrator');
	const { allMigrations } = await import('$lib/infrastructure/storage/sqlite/migrations');

	const db = await createTauriDatabase('rv-reservations.db');
	await runMigrations(db, allMigrations);

	const appDataRepo = createSqliteAppDataRepository(db);
	const siteSettingsRepo = createSqliteSiteSettingsRepository(db);

	await appDataRepo.init();
	await siteSettingsRepo.init();

	const repositories: StorageRepositories = {
		appData: appDataRepo,
		siteSettings: siteSettingsRepo
	};

	return {
		desktop: createTauriDesktopCapabilities(),
		repositories,
		reservationUseCases: createReservationUseCases(appDataRepo),
		parkingLocationUseCases: createParkingLocationUseCases(appDataRepo),
		adminSettingsUseCases: createAdminSettingsUseCases(siteSettingsRepo)
	};
}

/**
 * Get the application services singleton.
 * Returns LocalStorage services synchronously for web,
 * or SQLite services for Tauri desktop (requires async init).
 */
export function getAppServices(): AppServices {
	if (!instance) {
		instance = createLocalStorageServices();
	}
	return instance;
}

/**
 * Initialize the application services asynchronously.
 * In Tauri, this sets up the SQLite database and migrations.
 * In web, this is a no-op that returns the LocalStorage services.
 * Call this once at app startup before accessing getAppServices().
 */
export async function initAppServices(): Promise<AppServices> {
	if (instance) return instance;

	if (!initPromise) {
		initPromise = isTauri()
			? createSqliteServices().then((services) => {
					instance = services;
					return services;
				})
			: Promise.resolve(createLocalStorageServices()).then((services) => {
					instance = services;
					return services;
				});
	}

	return initPromise;
}
