import type { SiteSettingsRepository } from '$lib/application/ports';
import type { SiteSettings, MutationResult, AutoBackupIntervalMinutes } from '$lib/domain/models';

export interface AdminSettingsUseCases {
	loadSettings(): SiteSettings;
	updateSiteName(
		siteName: string,
		currentSettings: SiteSettings
	): MutationResult & { settings?: SiteSettings };
	setCompactView(
		compact: boolean,
		currentSettings: SiteSettings
	): { ok: true; settings: SiteSettings };
	setAutoBackupInterval(
		intervalMinutes: AutoBackupIntervalMinutes,
		currentSettings: SiteSettings
	): { ok: true; settings: SiteSettings };
	setAutoBackupDirectory(
		directoryPath: string | null,
		currentSettings: SiteSettings
	): { ok: true; settings: SiteSettings };
	recordAutoBackupTimestamp(
		timestamp: string,
		currentSettings: SiteSettings
	): { ok: true; settings: SiteSettings };
	setBetaUpdates(
		enabled: boolean,
		currentSettings: SiteSettings
	): { ok: true; settings: SiteSettings };
}

export function createAdminSettingsUseCases(
	repo: SiteSettingsRepository
): AdminSettingsUseCases {
	function mergeAutoBackup(
		currentSettings: SiteSettings,
		patch: Partial<SiteSettings['autoBackup'] & object>
	): SiteSettings {
		const current = currentSettings.autoBackup ?? {
			intervalMinutes: 0,
			directoryPath: null,
			lastBackupAt: null
		};
		return {
			...currentSettings,
			autoBackup: { ...current, ...patch }
		};
	}

	return {
		loadSettings(): SiteSettings {
			return repo.load();
		},

		updateSiteName(
			siteName: string,
			currentSettings: SiteSettings
		): MutationResult & { settings?: SiteSettings } {
			const trimmed = siteName.trim();
			if (!trimmed) {
				return { ok: false, errors: ['Site name is required.'] };
			}

			const saved = repo.save({ ...currentSettings, siteName: trimmed });
			return { ok: true, settings: saved };
		},

		setCompactView(
			compact: boolean,
			currentSettings: SiteSettings
		): { ok: true; settings: SiteSettings } {
			const saved = repo.save({ ...currentSettings, compactView: compact });
			return { ok: true, settings: saved };
		},

		setAutoBackupInterval(
			intervalMinutes: AutoBackupIntervalMinutes,
			currentSettings: SiteSettings
		): { ok: true; settings: SiteSettings } {
			const merged = mergeAutoBackup(currentSettings, { intervalMinutes });
			const saved = repo.save(merged);
			return { ok: true, settings: saved };
		},

		setAutoBackupDirectory(
			directoryPath: string | null,
			currentSettings: SiteSettings
		): { ok: true; settings: SiteSettings } {
			const merged = mergeAutoBackup(currentSettings, { directoryPath });
			const saved = repo.save(merged);
			return { ok: true, settings: saved };
		},

		recordAutoBackupTimestamp(
			timestamp: string,
			currentSettings: SiteSettings
		): { ok: true; settings: SiteSettings } {
			const merged = mergeAutoBackup(currentSettings, { lastBackupAt: timestamp });
			const saved = repo.save(merged);
			return { ok: true, settings: saved };
		},

		setBetaUpdates(
			enabled: boolean,
			currentSettings: SiteSettings
		): { ok: true; settings: SiteSettings } {
			const saved = repo.save({ ...currentSettings, betaUpdates: enabled });
			return { ok: true, settings: saved };
		}
	};
}
