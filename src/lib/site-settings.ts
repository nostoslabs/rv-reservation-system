import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { getAppServices } from '$lib/app/composition';
import { DEFAULT_SITE_NAME } from '$lib/storage';
import type { SiteSettings } from '$lib/types';

function getDefaultSettings(): SiteSettings {
	return {
		siteName: DEFAULT_SITE_NAME,
		adminPasscode: ''
	};
}

function createSiteSettingsStore() {
	const { adminSettingsUseCases } = getAppServices();
	const internal = writable<SiteSettings>(
		browser ? adminSettingsUseCases.loadSettings() : getDefaultSettings()
	);

	function hydrate(): void {
		if (!browser) return;
		internal.set(adminSettingsUseCases.loadSettings());
	}

	function setSiteName(siteName: string): SiteSettings {
		const current = get(internal);
		const result = adminSettingsUseCases.updateSiteName(siteName, current);
		if (result.ok && result.settings) {
			internal.set(result.settings);
			return result.settings;
		}
		return current;
	}

	function setAdminPasscode(adminPasscode: string): SiteSettings {
		const current = get(internal);
		const result = adminSettingsUseCases.updatePasscode(adminPasscode, current);
		if (result.ok && result.settings) {
			internal.set(result.settings);
			return result.settings;
		}
		return current;
	}

	function setCompactView(compact: boolean): SiteSettings {
		const current = get(internal);
		const result = adminSettingsUseCases.setCompactView(compact, current);
		internal.set(result.settings);
		return result.settings;
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		setSiteName,
		setAdminPasscode,
		setCompactView
	};
}

export const siteSettingsStore = createSiteSettingsStore();
