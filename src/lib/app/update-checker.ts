import { writable, type Readable } from 'svelte/store';
import type { DesktopCapabilities, UpdateInfo } from '$lib/application/ports';

export interface UpdateState {
	checking: boolean;
	available: UpdateInfo | null;
	downloading: boolean;
	downloadProgress: number;
	installed: boolean;
	error: string | null;
}

export interface UpdateChecker {
	state: Readable<UpdateState>;
	checkForUpdate(beta?: boolean): Promise<void>;
	downloadAndInstall(): Promise<void>;
	relaunch(): Promise<void>;
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
	installed: false,
	error: null
};

export function createUpdateChecker(desktop: DesktopCapabilities): UpdateChecker {
	const store = writable<UpdateState>({ ...initial });

	function patch(partial: Partial<UpdateState>): void {
		store.update((s) => ({ ...s, ...partial }));
	}

	return {
		state: { subscribe: store.subscribe },

		async checkForUpdate(beta?: boolean) {
			patch({ checking: true, error: null });
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
				patch({ checking: false, available: info });
			} catch (err) {
				patch({ checking: false, available: null, error: 'Failed to check for updates.' });
				console.error('Update check error:', err);
			}
		},

		async downloadAndInstall() {
			patch({ downloading: true, downloadProgress: 0, error: null });
			try {
				const ok = await desktop.downloadAndInstallUpdate((progress) => {
					if (progress.contentLength && progress.contentLength > 0) {
						const pct = Math.round((progress.downloadedLength / progress.contentLength) * 100);
						patch({ downloadProgress: Math.min(pct, 100) });
					}
				});
				if (ok) {
					patch({ downloading: false, downloadProgress: 100, installed: true });
				} else {
					patch({ downloading: false, available: null, error: 'Update returned false — check console for details.' });
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				patch({ downloading: false, available: null, error: `Update failed: ${msg}` });
				console.error('Update error:', err);
			}
		},

		async relaunch() {
			await desktop.relaunch();
		}
	};
}
