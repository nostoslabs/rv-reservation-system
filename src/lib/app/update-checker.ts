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
	checkForUpdate(): Promise<void>;
	downloadAndInstall(): Promise<void>;
	relaunch(): Promise<void>;
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

		async checkForUpdate() {
			patch({ checking: true, error: null });
			try {
				const info = await desktop.checkForUpdate();
				patch({ checking: false, available: info });
			} catch (err) {
				patch({ checking: false, error: 'Failed to check for updates.' });
				console.error('Update check error:', err);
			}
		},

		async downloadAndInstall() {
			patch({ downloading: true, downloadProgress: 0, error: null });
			try {
				const ok = await desktop.downloadAndInstallUpdate((progress) => {
					if (progress.contentLength && progress.contentLength > 0) {
						const pct = Math.round((progress.chunkLength / progress.contentLength) * 100);
						patch({ downloadProgress: Math.min(pct, 100) });
					}
				});
				if (ok) {
					patch({ downloading: false, downloadProgress: 100, installed: true });
				} else {
					patch({ downloading: false, error: 'Update installation failed.' });
				}
			} catch (err) {
				patch({ downloading: false, error: 'Update download failed.' });
				console.error('Update download error:', err);
			}
		},

		async relaunch() {
			await desktop.relaunch();
		}
	};
}
