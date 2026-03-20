import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { getAppServices } from '$lib/app/composition';
import { DEFAULT_SITE_NAME } from '$lib/storage';
import type { SiteSettings } from '$lib/types';

function getDefaultSettings(): SiteSettings {
	return {
		siteName: DEFAULT_SITE_NAME
	};
}

function createSiteSettingsStore() {
	const internal = writable<SiteSettings>(getDefaultSettings());

	function hydrate(): void {
		if (!browser) return;
		const { adminSettingsUseCases } = getAppServices();
		internal.set(adminSettingsUseCases.loadSettings());
	}

	async function setSiteName(siteName: string): Promise<SiteSettings> {
		const { adminSettingsUseCases } = getAppServices();
		const current = get(internal);
		const result = await adminSettingsUseCases.updateSiteName(siteName, current);
		if (result.ok && result.settings) {
			internal.set(result.settings);
			return result.settings;
		}
		return current;
	}

	async function setCompactView(compact: boolean): Promise<SiteSettings> {
		const { adminSettingsUseCases } = getAppServices();
		const current = get(internal);
		const result = await adminSettingsUseCases.setCompactView(compact, current);
		internal.set(result.settings);
		return result.settings;
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		setSiteName,
		setCompactView
	};
}

export const siteSettingsStore = createSiteSettingsStore();
