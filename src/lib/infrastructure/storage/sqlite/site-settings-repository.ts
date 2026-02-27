import type { SiteSettingsRepository } from '$lib/application/ports';
import type { SiteSettings } from '$lib/domain/models';
import { DEFAULT_SITE_NAME } from '$lib/storage';
import type { Database } from './types';

interface SettingRow {
	key: string;
	value: string;
}

function defaultSettings(): SiteSettings {
	return { siteName: DEFAULT_SITE_NAME, adminPasscode: '' };
}

function sanitize(settings: SiteSettings): SiteSettings {
	const siteName =
		settings.siteName?.trim().slice(0, 80) || DEFAULT_SITE_NAME;
	const adminPasscode =
		(settings.adminPasscode ?? '').trim().slice(0, 64);
	return { siteName, adminPasscode };
}

async function loadFromDb(db: Database): Promise<SiteSettings> {
	const rows = await db.select<SettingRow>('SELECT * FROM admin_settings');
	const map = new Map(rows.map((r) => [r.key, r.value]));
	return sanitize({
		siteName: map.get('site_name') ?? DEFAULT_SITE_NAME,
		adminPasscode: map.get('admin_passcode') ?? ''
	});
}

async function saveToDb(db: Database, settings: SiteSettings): Promise<void> {
	await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
		'site_name',
		settings.siteName
	]);
	await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
		'admin_passcode',
		settings.adminPasscode
	]);
}

/**
 * Create a SQLite-backed SiteSettingsRepository.
 * Must be initialized with `init()` before use.
 */
export function createSqliteSiteSettingsRepository(db: Database): SiteSettingsRepository & {
	init(): Promise<void>;
} {
	let cache: SiteSettings = defaultSettings();

	return {
		async init() {
			cache = await loadFromDb(db);
		},

		load(): SiteSettings {
			return cache;
		},

		save(settings: SiteSettings): SiteSettings {
			const sanitized = sanitize(settings);
			cache = sanitized;
			saveToDb(db, sanitized).catch((err) =>
				console.error('SQLite admin settings save failed:', err)
			);
			return sanitized;
		}
	};
}
