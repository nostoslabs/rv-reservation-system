import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { flushPendingWrites, getAppServices } from '$lib/app/composition';
import { DEFAULT_SITE_NAME } from '$lib/storage';
import type { AutoBackupIntervalMinutes, MutationResult, SiteSettings } from '$lib/types';

const SITE_SETTINGS_PERSISTENCE_ERROR = 'Unable to save settings to disk.';

type SiteSettingsMutationResult = MutationResult & { settings?: SiteSettings };

function getDefaultSettings(): SiteSettings {
	return {
		siteName: DEFAULT_SITE_NAME,
		compactView: false
	};
}

function createSiteSettingsStore() {
	// Always start with defaults. In Tauri, the module loads before
	// initAppServices() completes, so getAppServices() would return the
	// localStorage fallback (which has no data). hydrate() — called in
	// onMount after initAppServices() — reads from the correct backend.
	const internal = writable<SiteSettings>(getDefaultSettings());

	function hydrate(): void {
		if (!browser) return;
		const { adminSettingsUseCases } = getAppServices();
		internal.set(adminSettingsUseCases.loadSettings());
	}

	async function persistSettings(settings: SiteSettings): Promise<SiteSettingsMutationResult> {
		const { repositories } = getAppServices();

		try {
			repositories.siteSettings.save(settings);
			await flushPendingWrites();
			const persisted = repositories.siteSettings.load();
			internal.set(persisted);
			return { ok: true, settings: persisted };
		} catch (error) {
			console.error('Failed to persist site settings:', error);
			return { ok: false, errors: [SITE_SETTINGS_PERSISTENCE_ERROR] };
		}
	}

	async function setSiteName(siteName: string): Promise<SiteSettingsMutationResult> {
		const { adminSettingsUseCases } = getAppServices();
		const current = get(internal);
		const result = adminSettingsUseCases.updateSiteName(siteName, current);
		if (!result.ok || !result.settings) {
			return result;
		}

		return persistSettings(result.settings);
	}

	async function setCompactView(compact: boolean): Promise<SiteSettingsMutationResult> {
		const { adminSettingsUseCases } = getAppServices();
		const current = get(internal);
		const result = adminSettingsUseCases.setCompactView(compact, current);
		return persistSettings(result.settings);
	}

	async function setAutoBackupInterval(intervalMinutes: AutoBackupIntervalMinutes): Promise<SiteSettingsMutationResult> {
		const { adminSettingsUseCases } = getAppServices();
		const current = get(internal);
		const result = adminSettingsUseCases.setAutoBackupInterval(intervalMinutes, current);
		return persistSettings(result.settings);
	}

	async function setAutoBackupDirectory(directoryPath: string | null): Promise<SiteSettingsMutationResult> {
		const { adminSettingsUseCases } = getAppServices();
		const current = get(internal);
		const result = adminSettingsUseCases.setAutoBackupDirectory(directoryPath, current);
		return persistSettings(result.settings);
	}

	async function recordAutoBackup(timestamp: string): Promise<SiteSettingsMutationResult> {
		const { adminSettingsUseCases } = getAppServices();
		const current = get(internal);
		const result = adminSettingsUseCases.recordAutoBackupTimestamp(timestamp, current);
		return persistSettings(result.settings);
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		setSiteName,
		setCompactView,
		setAutoBackupInterval,
		setAutoBackupDirectory,
		recordAutoBackup
	};
}

export const siteSettingsStore = createSiteSettingsStore();
