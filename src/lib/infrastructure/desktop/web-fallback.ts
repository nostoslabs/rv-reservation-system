import type { DesktopCapabilities } from '$lib/application/ports';

/**
 * No-op web fallback for desktop capabilities.
 * Used when the app runs in a browser instead of a Tauri shell.
 */
export function createWebFallbackDesktopCapabilities(): DesktopCapabilities {
	return {
		isDesktop: false,
		async getAppDataDir() {
			return null;
		}
	};
}
