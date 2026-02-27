import { describe, it, expect, beforeEach, vi } from 'vitest';

// We can't easily test Tauri path in vitest (no window.__TAURI_INTERNALS__),
// but we can test that the web/LocalStorage path works correctly.

describe('composition root (web path)', () => {
	beforeEach(() => {
		// Reset the module between tests so the singleton is fresh
		vi.resetModules();
	});

	it('getAppServices returns LocalStorage services by default', async () => {
		const { getAppServices } = await import('$lib/app/composition');
		const services = getAppServices();

		expect(services).toBeDefined();
		expect(services.desktop.isDesktop).toBe(false);
		expect(services.repositories.appData).toBeDefined();
		expect(services.repositories.siteSettings).toBeDefined();
		expect(services.reservationUseCases).toBeDefined();
		expect(services.parkingLocationUseCases).toBeDefined();
	});

	it('initAppServices resolves to the same instance as getAppServices', async () => {
		const { getAppServices, initAppServices } = await import('$lib/app/composition');
		const services = await initAppServices();
		const same = getAppServices();

		expect(services).toBe(same);
	});

	it('initAppServices is idempotent', async () => {
		const { initAppServices } = await import('$lib/app/composition');
		const first = await initAppServices();
		const second = await initAppServices();

		expect(first).toBe(second);
	});
});
