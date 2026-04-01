import { describe, it, expect, vi } from 'vitest';
import { restoreBackup, type RestoreStores, type RestoreInput } from '$lib/application/use-cases/restore-backup';
import type { Customer } from '$lib/domain/customers';
import type { PersistedAppData, SiteSettings } from '$lib/domain/models';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: 'cust-1',
		name: 'Original Customer',
		phone: '555-0000',
		rvType: '',
		email: '',
		notes: '',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides
	};
}

function makeAppData(overrides: Partial<PersistedAppData> = {}): PersistedAppData {
	return {
		version: 4,
		reservations: [{
			index: 1,
			firstCellId: 'A-01::2025-06-01',
			name: 'Original Guest',
			rvType: '',
			phoneNumber: '555-1234',
			notes: '',
			startDate: '2025-06-01',
			endDate: '2025-06-05',
			parkingLocation: 'A-01',
			color: 'blue',
			status: 'reserved'
		}],
		parkingLocations: ['A-01', 'B-01'],
		nextReservationIndex: 2,
		lastSavedAt: 1000,
		...overrides
	};
}

function makeSettings(overrides: Partial<SiteSettings> = {}): SiteSettings {
	return {
		siteName: 'Original Park',
		compactView: false,
		...overrides
	};
}

function makeInput(overrides: Partial<RestoreInput> = {}): RestoreInput {
	return {
		customers: [makeCustomer({ id: 'new-cust', name: 'Backup Customer' })],
		reservations: [{
			index: 10,
			firstCellId: 'C-01::2025-07-01',
			name: 'Backup Guest',
			rvType: '',
			phoneNumber: '555-9999',
			notes: '',
			startDate: '2025-07-01',
			endDate: '2025-07-05',
			parkingLocation: 'C-01',
			color: 'green',
			status: 'reserved'
		}],
		parkingLocations: ['C-01'],
		nextReservationIndex: 11,
		version: 4,
		lastSavedAt: null,
		siteSettings: { siteName: 'Backup Park', compactView: true },
		...overrides
	};
}

function createMockStores(overrides: Partial<{
	replaceCustomersFail: boolean;
	importAppDataFail: boolean;
	setSiteNameFail: boolean;
	setCompactViewFail: boolean;
}> = {}): RestoreStores & {
	state: { customers: Customer[]; appData: PersistedAppData; settings: SiteSettings };
} {
	const state = {
		customers: [makeCustomer()],
		appData: makeAppData(),
		settings: makeSettings()
	};

	return {
		state,
		getCustomers: () => [...state.customers],
		getAppData: () => ({ ...state.appData }),
		getSettings: () => ({ ...state.settings }),

		replaceCustomers: vi.fn(async (c: Customer[]) => {
			if (overrides.replaceCustomersFail) return { ok: false, errors: ['Customer write failed'] };
			state.customers = c;
			return { ok: true };
		}),
		importAppData: vi.fn(async (d: PersistedAppData) => {
			if (overrides.importAppDataFail) return { ok: false, errors: ['App data write failed'] };
			state.appData = d;
			return { ok: true };
		}),
		setSiteName: vi.fn(async (n: string) => {
			if (overrides.setSiteNameFail) return { ok: false, errors: ['Settings write failed'] };
			state.settings = { ...state.settings, siteName: n };
			return { ok: true, settings: state.settings };
		}),
		setCompactView: vi.fn(async (v: boolean) => {
			if (overrides.setCompactViewFail) return { ok: false, errors: ['Compact view write failed'] };
			state.settings = { ...state.settings, compactView: v };
			return { ok: true };
		})
	};
}

describe('restoreBackup', () => {
	it('restores all data when all steps succeed', async () => {
		const stores = createMockStores();
		const input = makeInput();
		const result = await restoreBackup(input, stores);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.reservationCount).toBe(1);
			expect(result.customerCount).toBe(1);
		}
		expect(stores.state.customers[0].name).toBe('Backup Customer');
		expect(stores.state.appData.reservations[0].name).toBe('Backup Guest');
		expect(stores.state.settings.siteName).toBe('Backup Park');
		expect(stores.state.settings.compactView).toBe(true);
	});

	it('returns error without rollback when step 1 (customers) fails', async () => {
		const stores = createMockStores({ replaceCustomersFail: true });
		const result = await restoreBackup(makeInput(), stores);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('Customer');
		// Original data should be untouched
		expect(stores.state.customers[0].name).toBe('Original Customer');
		expect(stores.state.appData.reservations[0].name).toBe('Original Guest');
	});

	it('rolls back customers when step 2 (app data) fails', async () => {
		const stores = createMockStores({ importAppDataFail: true });
		const result = await restoreBackup(makeInput(), stores);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('App data');
		// Customers should be rolled back to original
		expect(stores.state.customers[0].name).toBe('Original Customer');
		// App data should be unchanged (import failed, not mutated)
		expect(stores.state.appData.reservations[0].name).toBe('Original Guest');
	});

	it('rolls back customers and app data when step 3 (settings) fails', async () => {
		const stores = createMockStores({ setSiteNameFail: true });
		const result = await restoreBackup(makeInput(), stores);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('Settings');
		// Both should be rolled back
		expect(stores.state.customers[0].name).toBe('Original Customer');
		expect(stores.state.appData.reservations[0].name).toBe('Original Guest');
		expect(stores.state.settings.siteName).toBe('Original Park');
	});

	it('skips settings step when siteSettings is null', async () => {
		const stores = createMockStores();
		const input = makeInput({ siteSettings: null });
		const result = await restoreBackup(input, stores);

		expect(result.ok).toBe(true);
		expect(stores.setSiteName).not.toHaveBeenCalled();
		expect(stores.setCompactView).not.toHaveBeenCalled();
		// Settings remain original
		expect(stores.state.settings.siteName).toBe('Original Park');
	});

	it('does not throw when rollback itself fails', async () => {
		const stores = createMockStores({ importAppDataFail: true });
		// Make the rollback (replaceCustomers) also fail by overriding after setup
		let callCount = 0;
		(stores.replaceCustomers as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			callCount++;
			if (callCount > 1) throw new Error('rollback failed');
			// First call succeeds (the initial restore attempt)
			stores.state.customers = makeInput().customers;
			return { ok: true };
		});

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await restoreBackup(makeInput(), stores);

		expect(result.ok).toBe(false);
		// Should not throw — gracefully handles rollback failure
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});
