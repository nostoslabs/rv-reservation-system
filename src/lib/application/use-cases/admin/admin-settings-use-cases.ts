import type { SiteSettingsRepository } from '$lib/application/ports';
import type { SiteSettings, MutationResult } from '$lib/domain/models';

export interface AdminSettingsUseCases {
	loadSettings(): SiteSettings;
	updateSiteName(
		siteName: string,
		currentSettings: SiteSettings
	): Promise<MutationResult & { settings?: SiteSettings }>;
	setCompactView(
		compact: boolean,
		currentSettings: SiteSettings
	): Promise<{ ok: true; settings: SiteSettings }>;
}

export function createAdminSettingsUseCases(
	repo: SiteSettingsRepository
): AdminSettingsUseCases {
	return {
		loadSettings(): SiteSettings {
			return repo.load();
		},

		async updateSiteName(
			siteName: string,
			currentSettings: SiteSettings
		): Promise<MutationResult & { settings?: SiteSettings }> {
			const trimmed = siteName.trim();
			if (!trimmed) {
				return { ok: false, errors: ['Site name is required.'] };
			}

			const saved = await repo.save({ ...currentSettings, siteName: trimmed });
			return { ok: true, settings: saved };
		},

		async setCompactView(
			compact: boolean,
			currentSettings: SiteSettings
		): Promise<{ ok: true; settings: SiteSettings }> {
			const saved = await repo.save({ ...currentSettings, compactView: compact });
			return { ok: true, settings: saved };
		}
	};
}
