import type { DesktopCapabilities, FileFilter, UpdateInfo, UpdateProgress } from '$lib/application/ports';

export function createTauriDesktopCapabilities(): DesktopCapabilities {
	interface PendingUpdate {
		version: string;
		date?: string | null;
		body?: string | null;
		downloadAndInstall(onEvent?: (event: { event: string; data?: Record<string, number | undefined> }) => void): Promise<void>;
	}

	let pendingUpdate: PendingUpdate | null = null;

	return {
		isDesktop: true,
		async getAppDataDir(): Promise<string | null> {
			try {
				const { appDataDir } = await import('@tauri-apps/api/path');
				return await appDataDir();
			} catch {
				return null;
			}
		},
		async getVersion(): Promise<string | null> {
			try {
				const { getVersion } = await import('@tauri-apps/api/app');
				return await getVersion();
			} catch {
				return null;
			}
		},
		async saveFile(defaultName: string, content: string, filters?: FileFilter[]): Promise<boolean> {
			const { save } = await import('@tauri-apps/plugin-dialog');
			const { writeTextFile } = await import('@tauri-apps/plugin-fs');
			const path = await save({
				defaultPath: defaultName,
				filters: filters ?? []
			});
			if (!path) return false;
			await writeTextFile(path, content);
			return true;
		},
		async openFile(filters?: FileFilter[]): Promise<string | null> {
			const { open } = await import('@tauri-apps/plugin-dialog');
			const { readTextFile } = await import('@tauri-apps/plugin-fs');
			const path = await open({
				multiple: false,
				directory: false,
				filters: filters ?? []
			});
			if (!path) return null;
			return await readTextFile(path);
		},
		async writeFileToPath(filePath: string, content: string): Promise<void> {
			const { writeTextFile } = await import('@tauri-apps/plugin-fs');
			await writeTextFile(filePath, content);
		},
		async pickDirectory(): Promise<string | null> {
			const { open } = await import('@tauri-apps/plugin-dialog');
			const path = await open({ multiple: false, directory: true });
			return path ?? null;
		},
		async checkForUpdate(): Promise<UpdateInfo | null> {
			const { check } = await import('@tauri-apps/plugin-updater');
			const { getVersion } = await import('@tauri-apps/api/app');
			const currentVersion = await getVersion();
			const update = await check();
			if (!update) {
				pendingUpdate = null;
				return null;
			}
			pendingUpdate = update;
			return {
				version: update.version,
				currentVersion,
				date: update.date ?? null,
				body: update.body ?? null
			};
		},
		async downloadAndInstallUpdate(onProgress?: (progress: UpdateProgress) => void): Promise<boolean> {
			if (!pendingUpdate) return false;
			try {
				let totalLength: number | null = null;
				let downloaded = 0;
				await pendingUpdate.downloadAndInstall((event) => {
					if (!onProgress || !event.data) return;
					if (event.event === 'Started') {
						totalLength = (event.data.contentLength as number) ?? null;
						downloaded = 0;
					} else if (event.event === 'Progress') {
						const chunk = (event.data.chunkLength as number) ?? 0;
						downloaded += chunk;
						onProgress({ downloadedLength: downloaded, contentLength: totalLength });
					}
				});
				pendingUpdate = null;
				return true;
			} catch (err) {
				console.error('Update install failed:', err);
				return false;
			}
		},
		async relaunch(): Promise<void> {
			const { relaunch } = await import('@tauri-apps/plugin-process');
			await relaunch();
		}
	};
}
