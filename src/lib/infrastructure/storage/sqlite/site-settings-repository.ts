import type { SiteSettingsRepository } from '$lib/application/ports';
import type { AutoBackupConfig, AutoBackupIntervalMinutes, SiteSettings } from '$lib/domain/models';
import { AUTO_BACKUP_INTERVALS } from '$lib/domain/models';
import { DEFAULT_SITE_NAME } from '$lib/storage';
import type { Database } from './types';
import type { SqliteWriteQueue } from './write-queue';

interface SettingRow {
	key: string;
	value: string;
}

function defaultAutoBackup(): AutoBackupConfig {
	return { intervalMinutes: 0, directoryPath: null, lastBackupAt: null };
}

function defaultSettings(): SiteSettings {
	return { siteName: DEFAULT_SITE_NAME, compactView: false, autoBackup: defaultAutoBackup() };
}

function sanitize(settings: SiteSettings): SiteSettings {
	const siteName =
		settings.siteName?.trim().slice(0, 80) || DEFAULT_SITE_NAME;
	const autoBackup = settings.autoBackup ?? defaultAutoBackup();
	const result: SiteSettings = { siteName, compactView: settings.compactView, autoBackup, betaUpdates: settings.betaUpdates };
	if (settings.siteColors && Object.keys(settings.siteColors).length > 0) {
		result.siteColors = settings.siteColors;
	}
	return result;
}

async function loadFromDb(db: Database): Promise<SiteSettings> {
	const rows = await db.select<SettingRow>('SELECT * FROM admin_settings');
	const map = new Map(rows.map((r) => [r.key, r.value]));

	const rawInterval = Number(map.get('auto_backup_interval') ?? '0');
	const intervalMinutes = (AUTO_BACKUP_INTERVALS as readonly number[]).includes(rawInterval)
		? (rawInterval as AutoBackupIntervalMinutes)
		: 0;

	let siteColors: Record<string, string> | undefined;
	const rawColors = map.get('site_colors');
	if (rawColors) {
		try {
			const hexPattern = /^#[0-9a-f]{6}$/i;
			const parsed = JSON.parse(rawColors);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				const cleaned: Record<string, string> = {};
				for (const [k, v] of Object.entries(parsed)) {
					if (typeof k === 'string' && k.trim() && typeof v === 'string' && hexPattern.test(v.trim())) {
						cleaned[k.trim()] = v.trim();
					}
				}
				if (Object.keys(cleaned).length > 0) {
					siteColors = cleaned;
				}
			}
		} catch { /* ignore invalid JSON */ }
	}

	return sanitize({
		siteName: map.get('site_name') ?? DEFAULT_SITE_NAME,
		compactView: map.get('compact_view') === '1',
		betaUpdates: map.get('beta_updates') === '1',
		autoBackup: {
			intervalMinutes,
			directoryPath: map.get('auto_backup_directory') ?? null,
			lastBackupAt: map.get('auto_backup_last_at') ?? null
		},
		siteColors
	});
}

async function saveToDb(db: Database, settings: SiteSettings): Promise<void> {
	await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
		'site_name',
		settings.siteName
	]);
	await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
		'compact_view',
		settings.compactView ? '1' : '0'
	]);
	await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
		'beta_updates',
		settings.betaUpdates ? '1' : '0'
	]);

	const ab = settings.autoBackup ?? defaultAutoBackup();
	await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
		'auto_backup_interval',
		String(ab.intervalMinutes)
	]);
	if (ab.directoryPath != null) {
		await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
			'auto_backup_directory',
			ab.directoryPath
		]);
	} else {
		await db.execute('DELETE FROM admin_settings WHERE key = ?', ['auto_backup_directory']);
	}
	if (ab.lastBackupAt != null) {
		await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
			'auto_backup_last_at',
			ab.lastBackupAt
		]);
	} else {
		await db.execute('DELETE FROM admin_settings WHERE key = ?', ['auto_backup_last_at']);
	}

	if (settings.siteColors && Object.keys(settings.siteColors).length > 0) {
		await db.execute('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)', [
			'site_colors',
			JSON.stringify(settings.siteColors)
		]);
	} else {
		await db.execute('DELETE FROM admin_settings WHERE key = ?', ['site_colors']);
	}
}

/**
 * Create a SQLite-backed SiteSettingsRepository.
 * Must be initialized with `init()` before use.
 */
export function createSqliteSiteSettingsRepository(db: Database, writes: SqliteWriteQueue): SiteSettingsRepository & {
	init(): Promise<void>;
	flush(): Promise<void>;
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
			writes.enqueue(() => saveToDb(db, sanitized), () => {
				cache = sanitized;
			});
			return sanitized;
		},

		async flush(): Promise<void> {
			await writes.flush();
		}
	};
}
