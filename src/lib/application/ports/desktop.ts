/**
 * Port for desktop-specific capabilities.
 * In the browser, these are no-ops. In Tauri, they delegate to native APIs.
 */
export interface DesktopCapabilities {
	/** Whether the app is running inside a Tauri desktop shell. */
	readonly isDesktop: boolean;

	/** Get the app data directory for persistent storage (Tauri only). */
	getAppDataDir(): Promise<string | null>;
}
