import type { DesktopCapabilities, FileFilter, UpdateInfo, UpdateProgress } from '$lib/application/ports';

// Module-level state to hold the pending update object between check and install
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pendingUpdate: any = null;

export function createTauriDesktopCapabilities(): DesktopCapabilities {
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
			try {
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
			} catch (err) {
				console.error('Update check failed:', err);
				pendingUpdate = null;
				return null;
			}
		},
		async downloadAndInstallUpdate(onProgress?: (progress: UpdateProgress) => void): Promise<boolean> {
			if (!pendingUpdate) return false;
			try {
				let totalLength: number | null = null;
				let downloaded = 0;
				await pendingUpdate.downloadAndInstall((event: { event: string; data: Record<string, number | undefined> }) => {
					if (!onProgress) return;
					if (event.event === 'Started') {
						totalLength = (event.data.contentLength as number) ?? null;
						downloaded = 0;
					} else if (event.event === 'Progress') {
						const chunk = (event.data.chunkLength as number) ?? 0;
						downloaded += chunk;
						onProgress({ chunkLength: downloaded, contentLength: totalLength });
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
