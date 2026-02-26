import type { AppDataRepository } from '$lib/application/ports';
import {
  clearPersistedAppData,
  getDefaultPersistedAppData,
  loadPersistedAppData,
  savePersistedAppData
} from '$lib/storage';

export function createLocalStorageAppDataRepository(): AppDataRepository {
  return {
    getDefaultData: getDefaultPersistedAppData,
    load: loadPersistedAppData,
    save: savePersistedAppData,
    clear: clearPersistedAppData
  };
}
