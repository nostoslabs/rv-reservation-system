import { describe, it, expect } from 'vitest';
import { createAdminSettingsUseCases } from '$lib/application/use-cases/admin';
import type { SiteSettingsRepository } from '$lib/application/ports';
import type { SiteSettings } from '$lib/types';

function createFakeRepo(): SiteSettingsRepository & { data: SiteSettings } {
	const state: SiteSettings = { siteName: 'Default' };
	return {
		data: state,
		load(): SiteSettings {
			return { ...state };
		},
		save(settings: SiteSettings): SiteSettings {
			Object.assign(state, settings);
			return { ...state };
		}
	};
}

describe('AdminSettingsUseCases', () => {
	it('loadSettings returns current settings from repo', () => {
		const repo = createFakeRepo();
		const useCases = createAdminSettingsUseCases(repo);
		const settings = useCases.loadSettings();
		expect(settings.siteName).toBe('Default');
	});

	it('updateSiteName saves and returns updated settings', () => {
		const repo = createFakeRepo();
		const useCases = createAdminSettingsUseCases(repo);
		const current = repo.load();
		const result = useCases.updateSiteName('My Park', current);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.settings?.siteName).toBe('My Park');
		}
	});

	it('updateSiteName rejects empty name', () => {
		const repo = createFakeRepo();
		const useCases = createAdminSettingsUseCases(repo);
		const current = repo.load();
		const result = useCases.updateSiteName('  ', current);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors).toContain('Site name is required.');
		}
	});

	it('updateSiteName trims whitespace', () => {
		const repo = createFakeRepo();
		const useCases = createAdminSettingsUseCases(repo);
		const current = repo.load();
		const result = useCases.updateSiteName('  Padded Name  ', current);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.settings?.siteName).toBe('Padded Name');
		}
	});
});
