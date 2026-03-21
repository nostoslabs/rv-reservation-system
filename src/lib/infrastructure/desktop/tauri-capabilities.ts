import type { DesktopCapabilities, FileFilter } from '$lib/application/ports';

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
		}
	};
}
