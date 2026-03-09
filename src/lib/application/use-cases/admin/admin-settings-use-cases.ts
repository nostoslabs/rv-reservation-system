import type { SiteSettingsRepository } from '$lib/application/ports';
import type { SiteSettings, MutationResult } from '$lib/domain/models';

export interface AdminSettingsUseCases {
	loadSettings(): SiteSettings;
	updateSiteName(
		siteName: string,
		currentSettings: SiteSettings
	): MutationResult & { settings?: SiteSettings };
	updatePasscode(
		passcode: string,
		currentSettings: SiteSettings
	): MutationResult & { settings?: SiteSettings };
	setCompactView(
		compact: boolean,
		currentSettings: SiteSettings
	): { ok: true; settings: SiteSettings };
}

export function createAdminSettingsUseCases(
	repo: SiteSettingsRepository
): AdminSettingsUseCases {
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

		updatePasscode(
			passcode: string,
			currentSettings: SiteSettings
		): MutationResult & { settings?: SiteSettings } {
			const trimmed = passcode.trim();
			if (!trimmed) {
				return { ok: false, errors: ['Passcode is required.'] };
			}

			const saved = repo.save({ ...currentSettings, adminPasscode: trimmed });
			return { ok: true, settings: saved };
		},

		setCompactView(
			compact: boolean,
			currentSettings: SiteSettings
		): { ok: true; settings: SiteSettings } {
			const saved = repo.save({ ...currentSettings, compactView: compact });
			return { ok: true, settings: saved };
		}
	};
}
