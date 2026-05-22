import type { DesktopCapabilities } from '$lib/application/ports';

export interface DesktopCapabilitiesMock {
	desktop: DesktopCapabilities;
	files: Map<string, string>;
	written: string[];
	writes: { path: string; content: string }[];
}

export function createDesktopCapabilitiesMock(
	overrides: Partial<DesktopCapabilities> = {}
): DesktopCapabilitiesMock {
	const files = new Map<string, string>();
	const written: string[] = [];
	const writes: { path: string; content: string }[] = [];

	const desktop: DesktopCapabilities = {
		isDesktop: true,
		getAppDataDir: async () => null,
		getVersion: async () => null,
		saveFile: async () => false,
		openFile: async () => null,
		writeFileToPath: async (path: string, content: string) => {
			written.push(path);
			writes.push({ path, content });
			files.set(path, content);
		},
		readFileFromPath: async (path: string) => files.get(path) ?? '',
		pickDirectory: async () => null,
		checkForUpdate: async () => null,
		checkBetaUpdate: async () => null,
		downloadUpdate: async () => false,
		installUpdateAndRestart: async () => false,
		relaunch: async () => {},
		...overrides
	};

	return { desktop, files, written, writes };
}
