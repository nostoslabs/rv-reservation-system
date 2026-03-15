import type { Reservation, SiteSettings } from '$lib/types';
import type { Customer } from '$lib/domain/customers';

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
		}
		if (!Array.isArray(d.customers)) {
			errors.push('data.customers must be an array.');
		}
	}

	return { valid: errors.length === 0, errors };
}
