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

	describe('site colors', () => {
		it('setSiteColor adds a color to settings', () => {
			const repo = createFakeRepo();
			const useCases = createAdminSettingsUseCases(repo);
			const current = repo.load();
			const result = useCases.setSiteColor('A-01', '#4477AA', current);
			expect(result.ok).toBe(true);
			expect(result.settings.siteColors).toEqual({ 'A-01': '#4477AA' });
		});

		it('setSiteColor with null removes the color', () => {
			const repo = createFakeRepo();
			const useCases = createAdminSettingsUseCases(repo);
			const withColor = useCases.setSiteColor('A-01', '#4477AA', repo.load()).settings;
			const result = useCases.setSiteColor('A-01', null, withColor);
			expect(result.ok).toBe(true);
			expect(result.settings.siteColors).toBeUndefined();
		});

		it('renameSiteColor transfers color to new key', () => {
			const repo = createFakeRepo();
			const useCases = createAdminSettingsUseCases(repo);
			const withColor = useCases.setSiteColor('A-01', '#EE6677', repo.load()).settings;
			const result = useCases.renameSiteColor('A-01', 'B-01', withColor);
			expect(result.ok).toBe(true);
			expect(result.settings.siteColors).toEqual({ 'B-01': '#EE6677' });
		});

		it('renameSiteColor is a no-op when site has no color', () => {
			const repo = createFakeRepo();
			const useCases = createAdminSettingsUseCases(repo);
			const current = repo.load();
			const result = useCases.renameSiteColor('A-01', 'B-01', current);
			expect(result.ok).toBe(true);
			expect(result.settings.siteColors).toBeUndefined();
		});

		it('removeSiteColor deletes the entry', () => {
			const repo = createFakeRepo();
			const useCases = createAdminSettingsUseCases(repo);
			const withColor = useCases.setSiteColor('A-01', '#228833', repo.load()).settings;
			const result = useCases.removeSiteColor('A-01', withColor);
			expect(result.ok).toBe(true);
			expect(result.settings.siteColors).toBeUndefined();
		});
	});
});
