import { describe, it, expect } from 'vitest';
import { createAdminSettingsUseCases } from '$lib/application/use-cases/admin';
import type { SiteSettingsRepository } from '$lib/application/ports';
import type { SiteSettings } from '$lib/types';

function createFakeRepo(): SiteSettingsRepository & { data: SiteSettings } {
	const state: SiteSettings = { siteName: 'Default', adminPasscode: '' };
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
		expect(settings.adminPasscode).toBe('');
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

	it('updatePasscode saves and returns updated settings', () => {
		const repo = createFakeRepo();
		const useCases = createAdminSettingsUseCases(repo);
		const current = repo.load();
		const result = useCases.updatePasscode('secret123', current);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.settings?.adminPasscode).toBe('secret123');
		}
	});

	it('updatePasscode rejects empty passcode', () => {
		const repo = createFakeRepo();
		const useCases = createAdminSettingsUseCases(repo);
		const current = repo.load();
		const result = useCases.updatePasscode('', current);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors).toContain('Passcode is required.');
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
