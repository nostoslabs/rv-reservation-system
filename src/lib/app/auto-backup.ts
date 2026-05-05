import type { AutoBackupConfig } from '$lib/types';
import type { DesktopCapabilities } from '$lib/application/ports';
import { writeVerifiedBackupToDirectory } from '$lib/app/verified-backup';
import { writable } from 'svelte/store';

export interface BackupStatus {
	lastError: string | null;
	lastErrorAt: string | null;
	consecutiveFailures: number;
}

export const backupStatus = writable<BackupStatus>({
	lastError: null,
	lastErrorAt: null,
	consecutiveFailures: 0
});

export function clearBackupStatus(): void {
	backupStatus.set({ lastError: null, lastErrorAt: null, consecutiveFailures: 0 });
}

export function recordBackupError(error: unknown): void {
	backupStatus.update((s) => ({
		lastError: error instanceof Error ? error.message : String(error),
		lastErrorAt: new Date().toISOString(),
		consecutiveFailures: s.consecutiveFailures + 1
	}));
}

export interface AutoBackupDeps {
	getConfig: () => AutoBackupConfig;
	getBackupContent: () => string;
	desktop: DesktopCapabilities;
	onSuccess: (timestamp: string) => Promise<void>;
	onError: (error: unknown) => void;
}

export function isBackupDue(config: AutoBackupConfig): boolean {
	if (config.intervalMinutes <= 0 || !config.directoryPath) return false;
	if (!config.lastBackupAt) return true;
	const elapsed = Date.now() - new Date(config.lastBackupAt).getTime();
	return elapsed >= config.intervalMinutes * 60_000;
}

export function startAutoBackupTimer(deps: AutoBackupDeps): () => void {
	let running = false;

	async function tick(): Promise<void> {
		if (running) return;

		const config = deps.getConfig();
		if (!isBackupDue(config)) return;

		running = true;
		try {
			const result = await writeVerifiedBackupToDirectory({
				desktop: deps.desktop,
				directoryPath: config.directoryPath!,
				getBackupContent: deps.getBackupContent
			});
			if (!result.ok) {
				throw new Error(result.error);
			}

			await deps.onSuccess(result.timestamp);
			clearBackupStatus();
		} catch (error) {
			deps.onError(error);
			recordBackupError(error);
		} finally {
			running = false;
		}
	}

	const intervalId = setInterval(() => void tick(), 60_000);
	// Run an initial check immediately
	void tick();

	return () => clearInterval(intervalId);
}
