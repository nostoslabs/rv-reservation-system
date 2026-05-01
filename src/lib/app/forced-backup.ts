import type { DesktopCapabilities } from '$lib/application/ports';
import { generateBackupFilename } from '$lib/domain/backup';

export const JSON_BACKUP_FILTERS = [{ name: 'JSON', extensions: ['json'] }];

export type ForcedBackupResult =
	| { ok: true }
	| { ok: false; error: string };

export interface ForcedBackupDeps {
	desktop: DesktopCapabilities;
	getBackupContent: () => string;
	getAutoBackupDirectory: () => string | null | undefined;
	onSuccess?: (timestamp: string) => Promise<void>;
}

function joinBackupPath(directoryPath: string, filename: string): string {
	const separator = directoryPath.endsWith('/') || directoryPath.endsWith('\\') ? '' : '/';
	return `${directoryPath}${separator}${filename}`;
}

function formatBackupError(error: unknown): string {
	return `Backup failed: ${error instanceof Error ? error.message : String(error)}`;
}

export async function createForcedBackup(deps: ForcedBackupDeps): Promise<ForcedBackupResult> {
	const filename = generateBackupFilename();
	const content = deps.getBackupContent();
	const directoryPath = deps.getAutoBackupDirectory();

	try {
		if (directoryPath) {
			await deps.desktop.writeFileToPath(joinBackupPath(directoryPath, filename), content);
		} else {
			const saved = await deps.desktop.saveFile(filename, content, JSON_BACKUP_FILTERS);
			if (!saved) {
				return { ok: false, error: 'Update blocked because backup was not saved.' };
			}
		}

		await deps.onSuccess?.(new Date().toISOString());
		return { ok: true };
	} catch (error) {
		return { ok: false, error: formatBackupError(error) };
	}
}
