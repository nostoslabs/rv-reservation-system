import type { Customer } from '$lib/domain/customers';
import type { PersistedAppData, Reservation, SiteSettings } from '$lib/domain/models';

export interface RestoreInput {
	customers: Customer[];
	reservations: Reservation[];
	parkingLocations: string[];
	nextReservationIndex: number;
	version: number;
	lastSavedAt: number | null;
	siteSettings: { siteName: string; compactView?: boolean } | null;
}

export interface RestoreStores {
	getCustomers(): Customer[];
	getAppData(): PersistedAppData;
	getSettings(): SiteSettings;
	replaceCustomers(c: Customer[]): Promise<{ ok: boolean; errors?: string[] }>;
	importAppData(d: PersistedAppData): Promise<{ ok: boolean; errors?: string[] }>;
	setSiteName(n: string): Promise<{ ok: boolean; settings?: SiteSettings; errors?: string[] }>;
	setCompactView(v: boolean): Promise<{ ok: boolean; errors?: string[] }>;
}

export type RestoreResult =
	| { ok: true; reservationCount: number; customerCount: number; siteName?: string }
	| { ok: false; error: string };

export async function restoreBackup(input: RestoreInput, stores: RestoreStores): Promise<RestoreResult> {
	const prevCustomers = stores.getCustomers();
	const prevAppData = stores.getAppData();
	const prevSettings = stores.getSettings();

	// Step 1: Replace customers (FK targets must exist before reservations)
	const customerResult = await stores.replaceCustomers(input.customers);
	if (!customerResult.ok) {
		return { ok: false, error: customerResult.errors?.[0] ?? 'Failed to restore customers.' };
	}

	// Step 2: Import reservations + parking locations
	const appDataResult = await stores.importAppData({
		version: input.version,
		reservations: input.reservations,
		parkingLocations: input.parkingLocations,
		nextReservationIndex: input.nextReservationIndex,
		lastSavedAt: input.lastSavedAt
	});
	if (!appDataResult.ok) {
		await safeRollbackCustomers(stores, prevCustomers);
		return { ok: false, error: appDataResult.errors?.[0] ?? 'Failed to restore reservations.' };
	}

	// Step 3: Import site settings (optional)
	let restoredSiteName: string | undefined;
	if (input.siteSettings) {
		const siteNameResult = await stores.setSiteName(input.siteSettings.siteName);
		if (!siteNameResult.ok) {
			await safeRollback(stores, prevCustomers, prevAppData, prevSettings);
			return { ok: false, error: siteNameResult.errors?.[0] ?? 'Failed to restore site settings.' };
		}
		restoredSiteName = siteNameResult.settings?.siteName;

		if (typeof input.siteSettings.compactView === 'boolean') {
			const compactResult = await stores.setCompactView(input.siteSettings.compactView);
			if (!compactResult.ok) {
				await safeRollback(stores, prevCustomers, prevAppData, prevSettings);
				return { ok: false, error: compactResult.errors?.[0] ?? 'Failed to restore site settings.' };
			}
		}
	}

	return {
		ok: true,
		reservationCount: input.reservations.length,
		customerCount: input.customers.length,
		siteName: restoredSiteName
	};
}

async function safeRollbackCustomers(stores: RestoreStores, prev: Customer[]): Promise<void> {
	try {
		const result = await stores.replaceCustomers(prev);
		if (!result.ok) {
			console.error('Rollback (customers) returned errors:', result.errors);
		}
	} catch (err) {
		console.error('Rollback (customers) failed:', err);
	}
}

async function safeRollback(
	stores: RestoreStores,
	prevCustomers: Customer[],
	prevAppData: PersistedAppData,
	prevSettings: SiteSettings
): Promise<void> {
	try {
		const result = await stores.replaceCustomers(prevCustomers);
		if (!result.ok) {
			console.error('Rollback (customers) returned errors:', result.errors);
		}
	} catch (err) {
		console.error('Rollback (customers) failed:', err);
	}
	try {
		const result = await stores.importAppData(prevAppData);
		if (!result.ok) {
			console.error('Rollback (app data) returned errors:', result.errors);
		}
	} catch (err) {
		console.error('Rollback (app data) failed:', err);
	}
	try {
		const result = await stores.setSiteName(prevSettings.siteName);
		if (!result.ok) {
			console.error('Rollback (site name) returned errors:', result.errors);
		}
		if (typeof prevSettings.compactView === 'boolean') {
			const cvResult = await stores.setCompactView(prevSettings.compactView);
			if (!cvResult.ok) {
				console.error('Rollback (compact view) returned errors:', cvResult.errors);
			}
		}
	} catch (err) {
		console.error('Rollback (settings) failed:', err);
	}
}
