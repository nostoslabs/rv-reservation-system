import type { DesktopCapabilities, StorageRepositories } from '$lib/application/ports';
import {
	createReservationUseCases,
	createParkingLocationUseCases,
	createAdminSettingsUseCases,
	createCustomerUseCases,
	createMergeCustomersUseCases,
	type ReservationUseCases,
	type ParkingLocationUseCases,
	type AdminSettingsUseCases,
	type CustomerUseCases,
	type MergeCustomersUseCases
} from '$lib/application/use-cases';
import { createWebFallbackDesktopCapabilities } from '$lib/infrastructure/desktop/web-fallback';
import { createLocalStorageAppDataRepository } from '$lib/infrastructure/storage/localstorage/app-data-repository';
import { createLocalStorageSiteSettingsRepository } from '$lib/infrastructure/storage/localstorage/site-settings-repository';
import { createLocalStorageCustomerRepository } from '$lib/infrastructure/storage/localstorage/customer-repository';

export interface AppServices {
	desktop: DesktopCapabilities;
	repositories: StorageRepositories;
	reservationUseCases: ReservationUseCases;
	parkingLocationUseCases: ParkingLocationUseCases;
	adminSettingsUseCases: AdminSettingsUseCases;
	customerUseCases: CustomerUseCases;
	mergeCustomersUseCases: MergeCustomersUseCases;
}

let instance: AppServices | null = null;
let initPromise: Promise<AppServices> | null = null;

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function buildAppServices(desktop: DesktopCapabilities, repositories: StorageRepositories): AppServices {
	return {
		desktop,
		repositories,
		reservationUseCases: createReservationUseCases(repositories.appData),
		parkingLocationUseCases: createParkingLocationUseCases(repositories.appData),
		adminSettingsUseCases: createAdminSettingsUseCases(repositories.siteSettings),
		customerUseCases: createCustomerUseCases(repositories.customers),
		mergeCustomersUseCases: createMergeCustomersUseCases(repositories.customers)
	};
}

function createLocalStorageServices(): AppServices {
	const repositories: StorageRepositories = {
		appData: createLocalStorageAppDataRepository(),
		siteSettings: createLocalStorageSiteSettingsRepository(),
		customers: createLocalStorageCustomerRepository()
	};

	return buildAppServices(createWebFallbackDesktopCapabilities(), repositories);
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
	const { createSqliteCustomerRepository } = await import(
		'$lib/infrastructure/storage/sqlite/customer-repository'
	);
	const { runMigrations } = await import('$lib/infrastructure/storage/sqlite/migrator');
	const { allMigrations } = await import('$lib/infrastructure/storage/sqlite/migrations');

	const db = await createTauriDatabase('rv-reservations.db');
	await runMigrations(db, allMigrations);

	const appDataRepo = createSqliteAppDataRepository(db);
	const siteSettingsRepo = createSqliteSiteSettingsRepository(db);
	const customerRepo = createSqliteCustomerRepository(db);

	await Promise.all([appDataRepo.init(), siteSettingsRepo.init(), customerRepo.init()]);

	const repositories: StorageRepositories = {
		appData: appDataRepo,
		siteSettings: siteSettingsRepo,
		customers: customerRepo
	};

	return buildAppServices(createTauriDesktopCapabilities(), repositories);
}

/**
 * Get the application services singleton.
 * Throws if called before initAppServices() completes in Tauri mode.
 * Returns LocalStorage services synchronously for web.
 */
export function getAppServices(): AppServices {
	if (!instance) {
		if (isTauri()) {
			throw new Error('getAppServices() called before initAppServices() completed');
		}
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
		initPromise = (isTauri() ? createSqliteServices() : Promise.resolve(createLocalStorageServices()))
			.then((services) => {
				instance = services;
				return services;
			});
	}

	return initPromise;
}

export async function registerPersistenceLifecycleHandlers(): Promise<() => void> {
	if (typeof window === 'undefined' || !isTauri()) {
		return () => {};
	}

	let closeCleanup: (() => void) | null = null;
	try {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		const appWindow = getCurrentWindow();
		let closing = false;

		closeCleanup = await appWindow.onCloseRequested(async (event) => {
			if (closing) return;
			closing = true;
			event.preventDefault();

			if (closeCleanup) {
				closeCleanup();
				closeCleanup = null;
			}
			await appWindow.close();
		});
	} catch (err) {
		console.error('Failed to register Tauri close handler:', err);
	}

	return () => {
		if (closeCleanup) {
			closeCleanup();
			closeCleanup = null;
		}
	};
}
