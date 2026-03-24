import { describe, it, expect } from 'vitest';
import { createBackup, normalizeBackupForRestore, validateBackup, BACKUP_APP_NAME, BACKUP_SCHEMA_VERSION } from '$lib/domain/backup';
import type { Reservation, SiteSettings, Customer } from '$lib/domain/models';

function makeFakeReservation(overrides: Partial<Reservation> = {}): Reservation {
	return {
		index: 1,
		firstCellId: 'A-01_2025-06-01',
		name: 'Test Guest',
		rvType: '',
		phoneNumber: '555-1234',
		notes: '',
		startDate: '2025-06-01',
		endDate: '2025-06-05',
		parkingLocation: 'A-01',
		color: 'blue',
		status: 'reserved',
		...overrides
	};
}

function makeFakeCustomer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: 'c1-uuid',
		name: 'Jane Doe',
		phone: '555-9999',
		rvType: '',
		email: 'jane@example.com',
		notes: '',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides
	};
}

describe('createBackup', () => {
	it('produces a valid backup object', () => {
		const reservations = [makeFakeReservation()];
		const parkingLocations = ['A-01', 'A-02'];
		const siteSettings: SiteSettings = { siteName: 'My Park', compactView: true };
		const customers = [makeFakeCustomer()];

		const backup = createBackup(reservations, parkingLocations, siteSettings, customers);

		expect(backup.schema.version).toBe(BACKUP_SCHEMA_VERSION);
		expect(backup.schema.appName).toBe(BACKUP_APP_NAME);
		expect(backup.schema.exportedAt).toBeTruthy();
		expect(backup.data.reservations).toEqual(reservations);
		expect(backup.data.parkingLocations).toEqual(parkingLocations);
		expect(backup.data.siteSettings.siteName).toBe('My Park');
		expect(backup.data.siteSettings.compactView).toBe(true);
		expect(backup.data.customers).toEqual(customers);
	});

	it('defaults compactView to false when undefined', () => {
		const backup = createBackup([], [], { siteName: 'Test' }, []);
		expect(backup.data.siteSettings.compactView).toBe(false);
	});
});

describe('validateBackup', () => {
	function makeValidBackup(): Record<string, unknown> {
		return {
			schema: { version: 1, appName: BACKUP_APP_NAME, exportedAt: '2025-01-01T00:00:00.000Z' },
			data: {
				reservations: [],
				parkingLocations: [],
				siteSettings: { siteName: 'Test', compactView: false },
				customers: []
			}
		};
	}

	it('validates a correct backup', () => {
		const result = validateBackup(makeValidBackup());
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('rejects null input', () => {
		const result = validateBackup(null);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Backup data must be a JSON object.');
	});

	it('rejects non-object input', () => {
		const result = validateBackup('hello');
		expect(result.valid).toBe(false);
	});

	it('rejects missing schema block', () => {
		const data = makeValidBackup();
		delete data.schema;
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('schema'))).toBe(true);
	});

	it('rejects schema with non-number version', () => {
		const data = makeValidBackup();
		(data.schema as Record<string, unknown>).version = 'abc';
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('version'))).toBe(true);
	});

	it('rejects schema version newer than supported', () => {
		const data = makeValidBackup();
		(data.schema as Record<string, unknown>).version = BACKUP_SCHEMA_VERSION + 1;
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('newer than supported'))).toBe(true);
	});

	it('accepts schema version equal to current', () => {
		const data = makeValidBackup();
		(data.schema as Record<string, unknown>).version = BACKUP_SCHEMA_VERSION;
		const result = validateBackup(data);
		expect(result.valid).toBe(true);
	});

	it('rejects missing exportedAt', () => {
		const data = makeValidBackup();
		delete (data.schema as Record<string, unknown>).exportedAt;
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('exportedAt'))).toBe(true);
	});

	it('rejects wrong appName', () => {
		const data = makeValidBackup();
		(data.schema as Record<string, unknown>).appName = 'wrong-app';
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('appName'))).toBe(true);
	});

	it('rejects missing data block', () => {
		const data = makeValidBackup();
		delete data.data;
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('data'))).toBe(true);
	});

	it('rejects non-array reservations', () => {
		const data = makeValidBackup();
		(data.data as Record<string, unknown>).reservations = 'not-array';
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('reservations'))).toBe(true);
	});

	it('rejects non-array parkingLocations', () => {
		const data = makeValidBackup();
		(data.data as Record<string, unknown>).parkingLocations = {};
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('parkingLocations'))).toBe(true);
	});

	it('rejects missing siteSettings', () => {
		const data = makeValidBackup();
		delete (data.data as Record<string, unknown>).siteSettings;
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('siteSettings'))).toBe(true);
	});

	it('rejects non-string siteSettings.siteName', () => {
		const data = makeValidBackup();
		((data.data as Record<string, unknown>).siteSettings as Record<string, unknown>).siteName = 123;
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('siteName'))).toBe(true);
	});

	it('rejects non-boolean siteSettings.compactView', () => {
		const data = makeValidBackup();
		((data.data as Record<string, unknown>).siteSettings as Record<string, unknown>).compactView = 'yes';
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('compactView'))).toBe(true);
	});

	it('rejects non-array customers', () => {
		const data = makeValidBackup();
		(data.data as Record<string, unknown>).customers = 'not-array';
		const result = validateBackup(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('customers'))).toBe(true);
	});

	it('collects multiple errors', () => {
		const result = validateBackup({ schema: 'bad', data: 'bad' });
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});
});

describe('normalizeBackupForRestore', () => {
	it('preserves customerId values that exist in the backup customer list', () => {
		const backup = createBackup(
			[makeFakeReservation({ customerId: 'c1-uuid' })],
			['A-01'],
			{ siteName: 'Test', compactView: false },
			[makeFakeCustomer({ id: 'c1-uuid' })]
		);

		const normalized = normalizeBackupForRestore(backup);

		expect(normalized.reservations[0].customerId).toBe('c1-uuid');
	});

	it('drops customerId values that do not exist in the backup customer list', () => {
		const backup = createBackup(
			[makeFakeReservation({ customerId: 'missing-customer' })],
			['A-01'],
			{ siteName: 'Test', compactView: false },
			[makeFakeCustomer({ id: 'different-customer' })]
		);

		const normalized = normalizeBackupForRestore(backup);

		expect(normalized.reservations[0].customerId).toBeUndefined();
	});
});
