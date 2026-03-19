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
		async saveFile(defaultName: string, content: string, filters?: FileFilter[]): Promise<boolean> {
			try {
				const { save } = await import('@tauri-apps/plugin-dialog');
				const { writeTextFile } = await import('@tauri-apps/plugin-fs');
				const { documentDir } = await import('@tauri-apps/api/path');

				let startDir: string | undefined;
				try {
					startDir = await documentDir();
				} catch {
					// Fall back to no default directory
				}

				const defaultPath = startDir ? `${startDir}/${defaultName}` : defaultName;
				const path = await save({
					defaultPath,
					filters: filters ?? []
				});
				if (!path) return false;
				await writeTextFile(path, content);
				return true;
			} catch (err) {
				console.error('Backup export failed:', err);
				return false;
			}
		},
		async openFile(filters?: FileFilter[]): Promise<string | null> {
			try {
				const { open } = await import('@tauri-apps/plugin-dialog');
				const { readTextFile } = await import('@tauri-apps/plugin-fs');
				const { documentDir } = await import('@tauri-apps/api/path');

				let startDir: string | undefined;
				try {
					startDir = await documentDir();
				} catch {
					// Fall back to no default directory
				}

				const path = await open({
					multiple: false,
					directory: false,
					defaultPath: startDir,
					filters: filters ?? []
				});
				if (!path) return null;
				return await readTextFile(path);
			} catch (err) {
				console.error('Backup import failed:', err);
				return null;
			}
		}
	};
}
