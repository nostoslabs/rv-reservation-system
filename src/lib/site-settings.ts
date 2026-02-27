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
	const { repositories } = getAppServices();
	const internal = writable<SiteSettings>(
		browser ? repositories.siteSettings.load() : getDefaultSettings()
	);

	function hydrate(): void {
		if (!browser) return;
		internal.set(repositories.siteSettings.load());
	}

	function commit(next: SiteSettings): SiteSettings {
		const saved = repositories.siteSettings.save(next);
		internal.set(saved);
		return saved;
	}

	function setSiteName(siteName: string): SiteSettings {
		const current = get(internal);
		return commit({
			...current,
			siteName
		});
	}

	function setAdminPasscode(adminPasscode: string): SiteSettings {
		const current = get(internal);
		return commit({
			...current,
			adminPasscode
		});
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		setSiteName,
		setAdminPasscode
	};
}

export const siteSettingsStore = createSiteSettingsStore();
