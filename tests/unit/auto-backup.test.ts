import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isBackupDue, startAutoBackupTimer, type AutoBackupDeps } from '$lib/app/auto-backup';
import type { AutoBackupConfig } from '$lib/types';

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

describe('startAutoBackupTimer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function makeDeps(config: AutoBackupConfig, overrides?: Partial<AutoBackupDeps>): AutoBackupDeps & { written: string[]; errors: unknown[] } {
		const written: string[] = [];
		const errors: unknown[] = [];
		return {
			written,
			errors,
			getConfig: () => config,
			getBackupContent: () => '{"test": true}',
			desktop: {
				isDesktop: true,
				getAppDataDir: async () => null,
				getVersion: async () => null,
				saveFile: async () => false,
				openFile: async () => null,
				writeFileToPath: async (path: string) => { written.push(path); },
				pickDirectory: async () => null
			},
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
			desktop: {
				isDesktop: true,
				getAppDataDir: async () => null,
				getVersion: async () => null,
				saveFile: async () => false,
				openFile: async () => null,
				writeFileToPath: async () => { throw new Error('disk full'); },
				pickDirectory: async () => null
			}
		});
		const stop = startAutoBackupTimer(deps);

		await vi.advanceTimersByTimeAsync(0);

		expect(deps.errors.length).toBe(1);
		expect((deps.errors[0] as Error).message).toBe('disk full');
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
