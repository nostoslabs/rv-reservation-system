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
		async saveFile(defaultName: string, content: string): Promise<boolean> {
			try {
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
			} catch {
				return false;
			}
		},
		async openFile(filters?: FileFilter[]): Promise<string | null> {
			return new Promise((resolve) => {
				const input = document.createElement('input');
				input.type = 'file';
				if (filters?.length) {
					input.accept = filters.flatMap((f: FileFilter) => f.extensions.map((e: string) => `.${e}`)).join(',');
				}
				input.style.display = 'none';
				input.addEventListener('change', async () => {
					const file = input.files?.[0];
					document.body.removeChild(input);
					if (!file) {
						resolve(null);
						return;
					}
					try {
						resolve(await file.text());
					} catch {
						resolve(null);
					}
				});
				input.addEventListener('cancel', () => {
					document.body.removeChild(input);
					resolve(null);
				});
				document.body.appendChild(input);
				input.click();
			});
		}
	};
}
