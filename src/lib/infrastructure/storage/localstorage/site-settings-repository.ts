import { browser } from '$app/environment';
import type { SiteSettingsRepository } from '$lib/application/ports';
import { DEFAULT_SITE_NAME } from '$lib/domain/defaults';
import type { AutoBackupIntervalMinutes, SiteSettings } from '$lib/domain/models';
import { AUTO_BACKUP_INTERVALS } from '$lib/domain/models';

const SETTINGS_STORAGE_KEY = 'rv-reservation-demo:settings:v1';

function sanitizeSiteSettings(value: unknown): SiteSettings {
	if (!value || typeof value !== 'object') {
		return {
			siteName: DEFAULT_SITE_NAME
		};
	}

	const raw = value as Record<string, unknown>;
	const siteName =
		typeof raw.siteName === 'string' && raw.siteName.trim()
			? raw.siteName.trim().slice(0, 80)
			: DEFAULT_SITE_NAME;

	const compactView = typeof raw.compactView === 'boolean' ? raw.compactView : false;

	const result: SiteSettings = { siteName, compactView };

	if (raw.autoBackup && typeof raw.autoBackup === 'object') {
		const ab = raw.autoBackup as Record<string, unknown>;
		const rawInterval = typeof ab.intervalMinutes === 'number' ? ab.intervalMinutes : 0;
		const intervalMinutes: AutoBackupIntervalMinutes =
			(AUTO_BACKUP_INTERVALS as readonly number[]).includes(rawInterval)
				? (rawInterval as AutoBackupIntervalMinutes)
				: 0;
		result.autoBackup = {
			intervalMinutes,
			directoryPath: typeof ab.directoryPath === 'string' ? ab.directoryPath : null,
			lastBackupAt: typeof ab.lastBackupAt === 'string' ? ab.lastBackupAt : null
		};
	}

	return result;
}

export function createLocalStorageSiteSettingsRepository(): SiteSettingsRepository {
	return {
		load(): SiteSettings {
			if (!browser) {
				return {
					siteName: DEFAULT_SITE_NAME
				};
			}

			try {
				const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
				if (!raw) {
					return {
						siteName: DEFAULT_SITE_NAME
					};
				}

				return sanitizeSiteSettings(JSON.parse(raw));
			} catch {
				return {
					siteName: DEFAULT_SITE_NAME
				};
			}
		},

		save(settings: SiteSettings): SiteSettings {
			const sanitized = sanitizeSiteSettings(settings);
			if (!browser) return sanitized;
			window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
			return sanitized;
		}
	};
}
