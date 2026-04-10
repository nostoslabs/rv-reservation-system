import type { AutoBackupConfig } from '$lib/types';
import type { DesktopCapabilities } from '$lib/application/ports';
import { generateBackupFilename } from '$lib/domain/backup';
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
			const content = deps.getBackupContent();
			const filename = generateBackupFilename();
			const separator = config.directoryPath!.endsWith('/') || config.directoryPath!.endsWith('\\') ? '' : '/';
			const filePath = `${config.directoryPath}${separator}${filename}`;
			await deps.desktop.writeFileToPath(filePath, content);
			await deps.onSuccess(new Date().toISOString());
			backupStatus.set({ lastError: null, lastErrorAt: null, consecutiveFailures: 0 });
		} catch (error) {
			deps.onError(error);
			backupStatus.update((s) => ({
				lastError: error instanceof Error ? error.message : String(error),
				lastErrorAt: new Date().toISOString(),
				consecutiveFailures: s.consecutiveFailures + 1
			}));
		} finally {
			running = false;
		}
	}

	const intervalId = setInterval(() => void tick(), 60_000);
	// Run an initial check immediately
	void tick();

	return () => clearInterval(intervalId);
}
