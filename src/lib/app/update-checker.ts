import { writable, type Readable } from 'svelte/store';
import type { DesktopCapabilities, UpdateInfo } from '$lib/application/ports';

export interface UpdateState {
	checking: boolean;
	available: UpdateInfo | null;
	downloading: boolean;
	downloadProgress: number;
	readyToInstall: boolean;
	installing: boolean;
	error: string | null;
}

export type PreUpdateBackupResult = { ok: true } | { ok: false; error: string };

export interface UpdateCheckerDeps {
	createPreUpdateBackup?: () => Promise<PreUpdateBackupResult>;
}

export interface UpdateChecker {
	state: Readable<UpdateState>;
	checkForUpdate(beta?: boolean): Promise<void>;
	downloadUpdate(): Promise<void>;
	installUpdateAndRestart(): Promise<void>;
}

const GITHUB_RELEASES_URL =
	'https://api.github.com/repos/nostoslabs/rv-reservation-system/releases';

async function findLatestReleaseEndpoint(): Promise<string | null> {
	const res = await fetch(GITHUB_RELEASES_URL, {
		headers: { Accept: 'application/vnd.github+json' }
	});
	if (!res.ok) return null;
	const releases: { assets: { name: string; browser_download_url: string }[] }[] = await res.json();
	for (const release of releases) {
		const asset = release.assets.find((a) => a.name === 'latest.json');
		if (asset) return asset.browser_download_url;
	}
	return null;
}

const initial: UpdateState = {
	checking: false,
	available: null,
	downloading: false,
	downloadProgress: 0,
	readyToInstall: false,
	installing: false,
	error: null
};

export function createUpdateChecker(desktop: DesktopCapabilities, deps: UpdateCheckerDeps = {}): UpdateChecker {
	const store = writable<UpdateState>({ ...initial });

	function patch(partial: Partial<UpdateState>): void {
		store.update((s) => ({ ...s, ...partial }));
	}

	return {
		state: { subscribe: store.subscribe },

		async checkForUpdate(beta?: boolean) {
			patch({ checking: true, error: null, readyToInstall: false });
			try {
				let info;
				if (beta) {
					const endpoint = await findLatestReleaseEndpoint();
					if (endpoint) {
						info = await desktop.checkBetaUpdate(endpoint);
					} else {
						info = null;
					}
				} else {
					info = await desktop.checkForUpdate();
				}
				patch({ checking: false, available: info, downloadProgress: 0 });
			} catch (err) {
				patch({ checking: false, available: null, readyToInstall: false, error: 'Failed to check for updates.' });
				console.error('Update check error:', err);
			}
		},

		async downloadUpdate() {
			patch({ downloading: true, readyToInstall: false, downloadProgress: 0, error: null });
			try {
				const ok = await desktop.downloadUpdate((progress) => {
					if (progress.contentLength && progress.contentLength > 0) {
						const pct = Math.round((progress.downloadedLength / progress.contentLength) * 100);
						patch({ downloadProgress: Math.min(pct, 100) });
					}
				});
				if (ok) {
					patch({ downloading: false, downloadProgress: 100, readyToInstall: true });
				} else {
					patch({ downloading: false, error: 'Update download failed.' });
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				patch({ downloading: false, error: `Update failed: ${msg}` });
				console.error('Update error:', err);
			}
		},

		async installUpdateAndRestart() {
			patch({ installing: true, error: null });
			try {
				const backup = deps.createPreUpdateBackup
					? await deps.createPreUpdateBackup()
					: { ok: false as const, error: 'Update blocked because backup is not configured.' };

				if (!backup.ok) {
					patch({ installing: false, readyToInstall: true, error: backup.error });
					return;
				}

				const ok = await desktop.installUpdateAndRestart();
				if (ok) {
					patch({
						installing: false,
						readyToInstall: false,
						available: null,
						downloadProgress: 0
					});
				} else {
					patch({ installing: false, readyToInstall: true, error: 'Update installation failed.' });
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				patch({ installing: false, readyToInstall: true, error: `Update failed: ${msg}` });
				console.error('Update install error:', err);
			}
		}
	};
}
