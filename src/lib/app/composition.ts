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
let properlyInitialized = false;

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function createLocalStorageServices(): AppServices {
	const appDataRepo = createLocalStorageAppDataRepository();
	const siteSettingsRepo = createLocalStorageSiteSettingsRepository();
	const customerRepo = createLocalStorageCustomerRepository();

	const repositories: StorageRepositories = {
		appData: appDataRepo,
		siteSettings: siteSettingsRepo,
		customers: customerRepo
	};

	return {
		desktop: createWebFallbackDesktopCapabilities(),
		repositories,
		reservationUseCases: createReservationUseCases(appDataRepo),
		parkingLocationUseCases: createParkingLocationUseCases(appDataRepo),
		adminSettingsUseCases: createAdminSettingsUseCases(siteSettingsRepo),
		customerUseCases: createCustomerUseCases(customerRepo),
		mergeCustomersUseCases: createMergeCustomersUseCases(customerRepo)
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

	await appDataRepo.init();
	await siteSettingsRepo.init();
	await customerRepo.init();

	const repositories: StorageRepositories = {
		appData: appDataRepo,
		siteSettings: siteSettingsRepo,
		customers: customerRepo
	};

	return {
		desktop: createTauriDesktopCapabilities(),
		repositories,
		reservationUseCases: createReservationUseCases(appDataRepo),
		parkingLocationUseCases: createParkingLocationUseCases(appDataRepo),
		adminSettingsUseCases: createAdminSettingsUseCases(siteSettingsRepo),
		customerUseCases: createCustomerUseCases(customerRepo),
		mergeCustomersUseCases: createMergeCustomersUseCases(customerRepo)
	};
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
		properlyInitialized = true;
	}
	return instance;
}

export function getActiveProvider(): string {
	return properlyInitialized && isTauri() ? 'SQLite' : 'localStorage (fallback)';
}

/**
 * Initialize the application services asynchronously.
 * In Tauri, this sets up the SQLite database and migrations.
 * In web, this is a no-op that returns the LocalStorage services.
 * Call this once at app startup before accessing getAppServices().
 */
export async function initAppServices(): Promise<AppServices> {
	if (properlyInitialized && instance) return instance;

	if (!initPromise) {
		initPromise = isTauri()
			? createSqliteServices().then((services) => {
					instance = services;
					properlyInitialized = true;
					return services;
				})
			: Promise.resolve(createLocalStorageServices()).then((services) => {
					instance = services;
					properlyInitialized = true;
					return services;
				});
	}

	return initPromise;
}

export async function registerPersistenceLifecycleHandlers(): Promise<() => void> {
	if (typeof window === 'undefined') {
		return () => {};
	}

	let closeCleanup: (() => void) | null = null;
	if (isTauri()) {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');
			const appWindow = getCurrentWindow();
			let closing = false;

			closeCleanup = await appWindow.onCloseRequested(async (event) => {
				if (closing) return;
				closing = true;
				event.preventDefault();

				try {
					// No flush needed — all writes are awaited inline
				} finally {
					if (closeCleanup) {
						closeCleanup();
						closeCleanup = null;
					}
					await appWindow.close();
				}
			});
		} catch (err) {
			console.error('Failed to register Tauri close handler:', err);
		}
	}

	return () => {
		if (closeCleanup) {
			closeCleanup();
			closeCleanup = null;
		}
	};
}
