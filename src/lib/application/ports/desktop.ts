export interface FileFilter {
	name: string;
	extensions: string[];
}

/**
 * Port for desktop-specific capabilities.
 * In the browser, these are no-ops or use web APIs. In Tauri, they delegate to native APIs.
 */
export interface DesktopCapabilities {
	/** Whether the app is running inside a Tauri desktop shell. */
	readonly isDesktop: boolean;

	/** Get the app data directory for persistent storage (Tauri only). */
	getAppDataDir(): Promise<string | null>;

	/** Show a save-file dialog and write content. Returns true if saved. */
	saveFile(defaultName: string, content: string, filters?: FileFilter[]): Promise<boolean>;

	/** Show an open-file dialog and read content. Returns file text or null if cancelled. */
	openFile(filters?: FileFilter[]): Promise<string | null>;
}
