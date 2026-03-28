import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { createUpdateChecker, type UpdateChecker } from '$lib/app/update-checker';
import type { DesktopCapabilities, UpdateInfo } from '$lib/application/ports';

function makeDesktop(overrides: Partial<DesktopCapabilities> = {}): DesktopCapabilities {
	return {
		isDesktop: true,
		getAppDataDir: async () => null,
		getVersion: async () => null,
		saveFile: async () => false,
		openFile: async () => null,
		writeFileToPath: async () => {},
		pickDirectory: async () => null,
		checkForUpdate: async () => null,
		downloadAndInstallUpdate: async () => false,
		relaunch: async () => {},
		...overrides
	};
}

const fakeUpdate: UpdateInfo = {
	version: '2.0.0',
	currentVersion: '1.13.1',
	date: '2026-03-28T00:00:00Z',
	body: 'New features'
};

describe('createUpdateChecker', () => {
	it('starts with idle state', () => {
		const checker = createUpdateChecker(makeDesktop());
		const state = get(checker.state);
		expect(state.checking).toBe(false);
		expect(state.available).toBeNull();
		expect(state.downloading).toBe(false);
		expect(state.installed).toBe(false);
		expect(state.error).toBeNull();
	});

	it('checkForUpdate sets checking then available', async () => {
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => fakeUpdate
		}));

		const promise = checker.checkForUpdate();
		expect(get(checker.state).checking).toBe(true);

		await promise;
		const state = get(checker.state);
		expect(state.checking).toBe(false);
		expect(state.available).toEqual(fakeUpdate);
	});

	it('checkForUpdate sets null when up to date', async () => {
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => null
		}));

		await checker.checkForUpdate();
		expect(get(checker.state).available).toBeNull();
	});

	it('checkForUpdate sets error on failure', async () => {
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => { throw new Error('network'); }
		}));

		await checker.checkForUpdate();
		const state = get(checker.state);
		expect(state.checking).toBe(false);
		expect(state.error).toBe('Failed to check for updates.');
	});

	it('downloadAndInstall tracks progress and sets installed', async () => {
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => fakeUpdate,
			downloadAndInstallUpdate: async () => true
		}));

		await checker.checkForUpdate();
		await checker.downloadAndInstall();

		const state = get(checker.state);
		expect(state.downloading).toBe(false);
		expect(state.installed).toBe(true);
	});

	it('downloadAndInstall sets error on failure', async () => {
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => fakeUpdate,
			downloadAndInstallUpdate: async () => false
		}));

		await checker.checkForUpdate();
		await checker.downloadAndInstall();

		const state = get(checker.state);
		expect(state.downloading).toBe(false);
		expect(state.installed).toBe(false);
		expect(state.error).toBe('Update installation failed.');
	});

	it('relaunch calls desktop.relaunch', async () => {
		const relaunchFn = vi.fn();
		const checker = createUpdateChecker(makeDesktop({
			relaunch: relaunchFn
		}));

		await checker.relaunch();
		expect(relaunchFn).toHaveBeenCalledOnce();
	});
});
