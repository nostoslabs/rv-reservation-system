import type { DesktopCapabilities } from '$lib/application/ports';

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
		}
	};
}
