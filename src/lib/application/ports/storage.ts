import type { PersistedAppData, SiteSettings } from '$lib/domain/models';
import type { CustomerRepository } from './customer';

export interface AppDataRepository {
  getDefaultData(): PersistedAppData;
  load(): PersistedAppData;
  save(data: PersistedAppData): number;
  clear(): void;
}

export interface SiteSettingsRepository {
  load(): SiteSettings;
  save(settings: SiteSettings): SiteSettings;
}

export interface StorageRepositories {
  appData: AppDataRepository;
  siteSettings: SiteSettingsRepository;
  customers: CustomerRepository;
}
