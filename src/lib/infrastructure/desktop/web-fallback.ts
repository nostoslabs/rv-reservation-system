import type { DesktopCapabilities, FileFilter } from '$lib/application/ports';

/**
 * Web fallback for desktop capabilities.
 * Uses browser APIs (download links, file inputs) instead of native dialogs.
 */
export function createWebFallbackDesktopCapabilities(): DesktopCapabilities {
	return {
		isDesktop: false,
		async getAppDataDir() {
			return null;
		},
		async getVersion() {
			return null;
		},
		async saveFile(defaultName: string, content: string): Promise<boolean> {
			const blob = new Blob([content], { type: 'application/octet-stream' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = defaultName;
			a.style.display = 'none';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			return true;
		},
		async writeFileToPath(): Promise<void> {
			// No-op in web — auto-backup is desktop-only
		},
		async pickDirectory(): Promise<string | null> {
			return null;
		},
		async checkForUpdate() {
			return null;
		},
		async downloadAndInstallUpdate() {
			return false;
		},
		async relaunch() {},
		async openFile(filters?: FileFilter[]): Promise<string | null> {
			return new Promise((resolve) => {
				let resolved = false;
				const done = (value: string | null) => {
					if (resolved) return;
					resolved = true;
					if (input.parentNode) document.body.removeChild(input);
					resolve(value);
				};

				const input = document.createElement('input');
				input.type = 'file';
				if (filters?.length) {
					input.accept = filters.flatMap((f: FileFilter) => f.extensions.map((e: string) => `.${e}`)).join(',');
				}
				input.style.display = 'none';
				input.addEventListener('change', async () => {
					const file = input.files?.[0];
					if (!file) {
						done(null);
						return;
					}
					try {
						done(await file.text());
					} catch {
						done(null);
					}
				});
				// Fallback for browsers where 'cancel' event doesn't fire:
				// when the file dialog closes, window regains focus.
				const onFocus = () => {
					setTimeout(() => {
						if (!resolved) done(null);
					}, 300);
				};
				window.addEventListener('focus', onFocus, { once: true });
				document.body.appendChild(input);
				input.click();
			});
		}
	};
}
