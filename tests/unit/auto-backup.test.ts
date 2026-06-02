import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	isBackupDue,
	runBackupOnExit,
	runManualBackupNow,
	startAutoBackupTimer,
	type AutoBackupDeps
} from '$lib/app/auto-backup';
import type { AutoBackupConfig } from '$lib/types';
import { createDesktopCapabilitiesMock } from './desktop-capabilities.fixture';

describe('isBackupDue', () => {
	it('returns false when interval is 0 (off)', () => {
		expect(isBackupDue({ intervalMinutes: 0, directoryPath: '/backups', lastBackupAt: null })).toBe(false);
	});

	it('returns false when directoryPath is null', () => {
		expect(isBackupDue({ intervalMinutes: 30, directoryPath: null, lastBackupAt: null })).toBe(false);
	});

	it('returns true when no previous backup exists', () => {
		expect(isBackupDue({ intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: null })).toBe(true);
	});

	it('returns true when enough time has elapsed', () => {
		const thirtyOneMinAgo = new Date(Date.now() - 31 * 60_000).toISOString();
		expect(isBackupDue({ intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: thirtyOneMinAgo })).toBe(true);
	});

	it('returns false when not enough time has elapsed', () => {
		const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
		expect(isBackupDue({ intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: tenMinAgo })).toBe(false);
	});

	it('returns true when exactly interval has elapsed', () => {
		const exactlyThirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
		expect(isBackupDue({ intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: exactlyThirtyMinAgo })).toBe(true);
	});
});

describe('runManualBackupNow', () => {
	it('writes a verified backup and records the timestamp', async () => {
		const desktopMock = createDesktopCapabilitiesMock();
		const onSuccess = vi.fn(async () => ({ ok: true }));

		const result = await runManualBackupNow({
			desktop: desktopMock.desktop,
			directoryPath: '/backups',
			getBackupContent: () => '{"test": true}',
			onSuccess
		});

		expect(result).toEqual({ ok: true });
		expect(desktopMock.written[0]).toMatch(/^\/backups\/rv-backup-.*\.json$/);
		expect(onSuccess).toHaveBeenCalledOnce();
	});

	it('returns a timestamp persistence error without recording backup failure status', async () => {
		const result = await runManualBackupNow({
			desktop: createDesktopCapabilitiesMock().desktop,
			directoryPath: '/backups',
			getBackupContent: () => '{"test": true}',
			onSuccess: async () => ({ ok: false, errors: ['Settings write failed'] })
		});

		expect(result).toEqual({ ok: false, error: 'Settings write failed' });
	});
});

describe('runBackupOnExit', () => {
	it('does nothing when no backup directory is configured', async () => {
		const desktopMock = createDesktopCapabilitiesMock();

		await expect(
			runBackupOnExit({
				desktop: desktopMock.desktop,
				getConfig: () => ({ intervalMinutes: 30, directoryPath: null, lastBackupAt: null }),
				getBackupContent: () => '{"test": true}',
				onSuccess: async () => ({ ok: true })
			})
		).resolves.toBeUndefined();

		expect(desktopMock.written).toHaveLength(0);
	});

	it('writes a verified backup when a backup directory is configured', async () => {
		const desktopMock = createDesktopCapabilitiesMock();
		const onSuccess = vi.fn(async () => ({ ok: true }));

		await runBackupOnExit({
			desktop: desktopMock.desktop,
			getConfig: () => ({ intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: null }),
			getBackupContent: () => '{"test": true}',
			onSuccess
		});

		expect(desktopMock.written).toHaveLength(1);
		expect(desktopMock.written[0]).toMatch(/^\/backups\/rv-backup-.*\.json$/);
		expect(onSuccess).toHaveBeenCalledOnce();
	});

	it('swallows backup failures so close can continue', async () => {
		const onFailure = vi.fn(async () => ({ ok: true }));

		await expect(
			runBackupOnExit({
				desktop: createDesktopCapabilitiesMock({
					writeFileToPath: async () => {
						throw new Error('disk full');
					}
				}).desktop,
				getConfig: () => ({ intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: null }),
				getBackupContent: () => '{"test": true}',
				onSuccess: async () => ({ ok: true }),
				onFailure
			})
		).resolves.toBeUndefined();

		expect(onFailure).toHaveBeenCalledWith('Backup failed: disk full');
	});

	it('swallows config load failures so close can continue', async () => {
		await expect(
			runBackupOnExit({
				desktop: createDesktopCapabilitiesMock().desktop,
				getConfig: () => {
					throw new Error('settings read failed');
				},
				getBackupContent: () => '{"test": true}',
				onSuccess: async () => ({ ok: true })
			})
		).resolves.toBeUndefined();
	});
});

describe('startAutoBackupTimer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function makeDeps(config: AutoBackupConfig, overrides?: Partial<AutoBackupDeps>): AutoBackupDeps & { written: string[]; errors: unknown[] } {
		const desktopMock = createDesktopCapabilitiesMock();
		const errors: unknown[] = [];
		return {
			written: desktopMock.written,
			errors,
			getConfig: () => config,
			getBackupContent: () => '{"test": true}',
			desktop: desktopMock.desktop,
			onSuccess: async () => {},
			onError: (err) => errors.push(err),
			...overrides
		};
	}

	it('runs initial tick immediately and writes backup when due', async () => {
		const config: AutoBackupConfig = { intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: null };
		const deps = makeDeps(config);
		const stop = startAutoBackupTimer(deps);

		// Let the microtask queue flush for the async tick
		await vi.advanceTimersByTimeAsync(0);

		expect(deps.written.length).toBe(1);
		expect(deps.written[0]).toMatch(/^\/backups\/rv-backup-.*\.json$/);

		stop();
	});

	it('does not write when backup is not due', async () => {
		const config: AutoBackupConfig = {
			intervalMinutes: 30,
			directoryPath: '/backups',
			lastBackupAt: new Date().toISOString()
		};
		const deps = makeDeps(config);
		const stop = startAutoBackupTimer(deps);

		await vi.advanceTimersByTimeAsync(0);

		expect(deps.written.length).toBe(0);
		stop();
	});

		it('calls onError when writeFileToPath throws', async () => {
			const config: AutoBackupConfig = { intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: null };
			const deps = makeDeps(config, {
				desktop: createDesktopCapabilitiesMock({
					writeFileToPath: async () => { throw new Error('disk full'); }
				}).desktop
			});
			const stop = startAutoBackupTimer(deps);

		await vi.advanceTimersByTimeAsync(0);

		expect(deps.errors.length).toBe(1);
		expect((deps.errors[0] as Error).message).toBe('Backup failed: disk full');
		stop();
	});

		it('calls onError and skips success when read-back verification fails', async () => {
			const config: AutoBackupConfig = { intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: null };
			let successTimestamp: string | null = null;
			const deps = makeDeps(config, {
				desktop: createDesktopCapabilitiesMock({
					writeFileToPath: async () => {},
					readFileFromPath: async () => '{"test": false}'
				}).desktop,
				onSuccess: async (ts) => { successTimestamp = ts; }
			});
			const stop = startAutoBackupTimer(deps);

		await vi.advanceTimersByTimeAsync(0);

		expect(successTimestamp).toBeNull();
		expect(deps.errors.length).toBe(1);
		expect((deps.errors[0] as Error).message).toBe('Backup verification failed: written file contents did not match generated backup.');
		stop();
	});

	it('calls onSuccess with ISO timestamp after writing', async () => {
		const config: AutoBackupConfig = { intervalMinutes: 5, directoryPath: '/tmp/bk', lastBackupAt: null };
		let successTimestamp: string | null = null;
		const deps = makeDeps(config, {
			onSuccess: async (ts) => { successTimestamp = ts; }
		});
		const stop = startAutoBackupTimer(deps);

		await vi.advanceTimersByTimeAsync(0);

		expect(successTimestamp).not.toBeNull();
		expect(new Date(successTimestamp!).getTime()).toBeGreaterThan(0);
		stop();
	});

	it('cleans up interval on stop', async () => {
		const config: AutoBackupConfig = { intervalMinutes: 30, directoryPath: '/backups', lastBackupAt: new Date().toISOString() };
		const deps = makeDeps(config);
		const stop = startAutoBackupTimer(deps);

		stop();

		// Advance past several intervals — should not fire
		await vi.advanceTimersByTimeAsync(300_000);
		expect(deps.written.length).toBe(0);
	});

	it('appends separator when directoryPath does not end with slash', async () => {
		const config: AutoBackupConfig = { intervalMinutes: 5, directoryPath: '/my/backups', lastBackupAt: null };
		const deps = makeDeps(config);
		const stop = startAutoBackupTimer(deps);

		await vi.advanceTimersByTimeAsync(0);

		expect(deps.written[0]).toMatch(/^\/my\/backups\/rv-backup-/);
		stop();
	});

	it('does not double-slash when directoryPath ends with slash', async () => {
		const config: AutoBackupConfig = { intervalMinutes: 5, directoryPath: '/my/backups/', lastBackupAt: null };
		const deps = makeDeps(config);
		const stop = startAutoBackupTimer(deps);

		await vi.advanceTimersByTimeAsync(0);

		expect(deps.written[0]).toMatch(/^\/my\/backups\/rv-backup-/);
		expect(deps.written[0]).not.toContain('//');
		stop();
	});
});
