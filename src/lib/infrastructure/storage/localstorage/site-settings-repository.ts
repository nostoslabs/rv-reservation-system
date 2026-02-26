import type { SiteSettingsRepository } from '$lib/application/ports';
import { loadSiteSettings, saveSiteSettings } from '$lib/storage';

export function createLocalStorageSiteSettingsRepository(): SiteSettingsRepository {
  return {
    load: loadSiteSettings,
    save: saveSiteSettings
  };
}
