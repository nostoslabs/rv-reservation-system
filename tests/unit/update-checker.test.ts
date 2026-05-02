import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { createUpdateChecker } from '$lib/app/update-checker';
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
		checkBetaUpdate: async () => null,
		downloadUpdate: async () => false,
		installUpdateAndRestart: async () => false,
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
		expect(state.installing).toBe(false);
		expect(state.readyToInstall).toBe(false);
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

	it('downloadUpdate tracks progress and marks the update ready to install', async () => {
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => fakeUpdate,
			downloadUpdate: async (onProgress) => {
				onProgress?.({ downloadedLength: 50, contentLength: 100 });
				return true;
			}
		}));

		await checker.checkForUpdate();
		await checker.downloadUpdate();

		const state = get(checker.state);
		expect(state.downloading).toBe(false);
		expect(state.downloadProgress).toBe(100);
		expect(state.readyToInstall).toBe(true);
	});

	it('downloadUpdate sets error on failure', async () => {
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => fakeUpdate,
			downloadUpdate: async () => false
		}));

		await checker.checkForUpdate();
		await checker.downloadUpdate();

		const state = get(checker.state);
		expect(state.downloading).toBe(false);
		expect(state.readyToInstall).toBe(false);
		expect(state.error).toBe('Update download failed.');
	});

	it('installUpdateAndRestart creates a backup before installing', async () => {
		const installFn = vi.fn(async () => true);
		const backupFn = vi.fn(async () => ({ ok: true as const }));
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => fakeUpdate,
			downloadUpdate: async () => true,
			installUpdateAndRestart: installFn
		}), { createPreUpdateBackup: backupFn });

		await checker.checkForUpdate();
		await checker.downloadUpdate();
		await checker.installUpdateAndRestart();

		expect(backupFn).toHaveBeenCalledOnce();
		expect(installFn).toHaveBeenCalledOnce();
		expect(backupFn.mock.invocationCallOrder[0]).toBeLessThan(installFn.mock.invocationCallOrder[0]);
		expect(get(checker.state).readyToInstall).toBe(false);
	});

	it('installUpdateAndRestart blocks installation when backup fails', async () => {
		const installFn = vi.fn(async () => true);
		const checker = createUpdateChecker(makeDesktop({
			checkForUpdate: async () => fakeUpdate,
			downloadUpdate: async () => true,
			installUpdateAndRestart: installFn
		}), {
			createPreUpdateBackup: async () => ({ ok: false, error: 'Backup failed: disk full' })
		});

		await checker.checkForUpdate();
		await checker.downloadUpdate();
		await checker.installUpdateAndRestart();

		const state = get(checker.state);
		expect(installFn).not.toHaveBeenCalled();
		expect(state.installing).toBe(false);
		expect(state.readyToInstall).toBe(true);
		expect(state.error).toBe('Backup failed: disk full');
	});
});
