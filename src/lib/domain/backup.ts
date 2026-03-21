import type { Reservation, SiteSettings, Customer } from '$lib/domain/models';

export interface BackupSchema {
	version: number;
	appName: string;
	exportedAt: string;
}

export interface BackupData {
	reservations: Reservation[];
	parkingLocations: string[];
	siteSettings: {
		siteName: string;
		compactView: boolean;
	};
	customers: Customer[];
}

export interface AppBackup {
	schema: BackupSchema;
	data: BackupData;
}

export const BACKUP_APP_NAME = 'rv-reservation-system';
export const BACKUP_SCHEMA_VERSION = 1;

export function generateBackupFilename(): string {
	const now = new Date();
	const dateStr = now.toISOString().slice(0, 10);
	const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
	return `rv-backup-${dateStr}-${timeStr}.json`;
}

export function createBackup(
	reservations: Reservation[],
	parkingLocations: string[],
	siteSettings: SiteSettings,
	customers: Customer[]
): AppBackup {
	return {
		schema: {
			version: BACKUP_SCHEMA_VERSION,
			appName: BACKUP_APP_NAME,
			exportedAt: new Date().toISOString()
		},
		data: {
			reservations,
			parkingLocations,
			siteSettings: {
				siteName: siteSettings.siteName,
				compactView: siteSettings.compactView ?? false
			},
			customers
		}
	};
}

export function normalizeBackupForRestore(backup: AppBackup): BackupData {
	const knownCustomerIds = new Set(backup.data.customers.map((customer) => customer.id));
	const reservations = backup.data.reservations.map((reservation) => {
		if (!reservation.customerId || knownCustomerIds.has(reservation.customerId)) {
			return reservation;
		}

		return {
			...reservation,
			customerId: undefined
		};
	});

	return {
		reservations,
		parkingLocations: [...backup.data.parkingLocations],
		siteSettings: {
			siteName: backup.data.siteSettings.siteName,
			compactView: backup.data.siteSettings.compactView
		},
		customers: backup.data.customers.map((customer) => ({ ...customer }))
	};
}

export function validateBackup(data: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!data || typeof data !== 'object') {
		return { valid: false, errors: ['Backup data must be a JSON object.'] };
	}

	const raw = data as Record<string, unknown>;

	// Validate schema block
	if (!raw.schema || typeof raw.schema !== 'object') {
		errors.push('Missing or invalid "schema" block.');
	} else {
		const schema = raw.schema as Record<string, unknown>;
		if (typeof schema.version !== 'number') {
			errors.push('schema.version must be a number.');
		} else if (schema.version > BACKUP_SCHEMA_VERSION) {
			errors.push(`schema.version ${schema.version} is newer than supported version ${BACKUP_SCHEMA_VERSION}.`);
		}
		if (typeof schema.exportedAt !== 'string') {
			errors.push('schema.exportedAt must be a string.');
		}
		if (schema.appName !== BACKUP_APP_NAME) {
			errors.push(`schema.appName must be "${BACKUP_APP_NAME}".`);
		}
	}

	// Validate data block
	if (!raw.data || typeof raw.data !== 'object') {
		errors.push('Missing or invalid "data" block.');
	} else {
		const d = raw.data as Record<string, unknown>;
		if (!Array.isArray(d.reservations)) {
			errors.push('data.reservations must be an array.');
		}
		if (!Array.isArray(d.parkingLocations)) {
			errors.push('data.parkingLocations must be an array.');
		}
		if (!d.siteSettings || typeof d.siteSettings !== 'object') {
			errors.push('data.siteSettings must be an object.');
		} else {
			const ss = d.siteSettings as Record<string, unknown>;
			if (typeof ss.siteName !== 'string') {
				errors.push('data.siteSettings.siteName must be a string.');
			}
			if (typeof ss.compactView !== 'boolean') {
				errors.push('data.siteSettings.compactView must be a boolean.');
			}
		}
		if (!Array.isArray(d.customers)) {
			errors.push('data.customers must be an array.');
		}
	}

	return { valid: errors.length === 0, errors };
}
