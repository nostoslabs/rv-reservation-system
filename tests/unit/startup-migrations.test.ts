import { describe, it, expect, vi } from 'vitest';
import { runStartupMigrations } from '$lib/app/startup-migrations';
import type { AppServices } from '$lib/app/composition';

function makeStubServices(): AppServices {
	return {
		desktop: {
			isDesktop: false,
			getAppDataDir: async () => null,
			getVersion: async () => null,
			saveFile: async () => false,
			openFile: async () => null,
			writeFileToPath: async () => {},
			pickDirectory: async () => null
		},
		repositories: {
			appData: {
				getDefaultData: vi.fn(),
				load: vi.fn(),
				save: vi.fn(),
				clear: vi.fn()
			},
			siteSettings: {
				load: vi.fn(),
				save: vi.fn()
			},
			customers: {
				getAll: vi.fn().mockReturnValue([]),
				getById: vi.fn(),
				save: vi.fn(),
				remove: vi.fn(),
				replaceAll: vi.fn()
			}
		},
		reservationUseCases: {} as any,
		parkingLocationUseCases: {} as any,
		adminSettingsUseCases: {} as any,
		customerUseCases: {} as any,
		mergeCustomersUseCases: {} as any
	};
}

describe('runStartupMigrations', () => {
	it('is a no-op (auto-dedup disabled until cache/DB consistency is fixed)', () => {
		const services = makeStubServices();

		runStartupMigrations(services);

		expect(services.repositories.appData.save).not.toHaveBeenCalled();
		expect(services.repositories.customers.replaceAll).not.toHaveBeenCalled();
	});
});
