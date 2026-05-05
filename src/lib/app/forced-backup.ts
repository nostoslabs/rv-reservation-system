import type { DesktopCapabilities } from '$lib/application/ports';
import { generateBackupFilename } from '$lib/domain/backup';
import { writeVerifiedBackupToDirectory } from '$lib/app/verified-backup';

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

function formatBackupError(error: unknown): string {
	return `Backup failed: ${error instanceof Error ? error.message : String(error)}`;
}

export async function createForcedBackup(deps: ForcedBackupDeps): Promise<ForcedBackupResult> {
	const content = deps.getBackupContent();
	const directoryPath = deps.getAutoBackupDirectory();

	try {
		if (directoryPath) {
			const result = await writeVerifiedBackupToDirectory({
				desktop: deps.desktop,
				directoryPath,
				getBackupContent: () => content
			});
			if (!result.ok) return result;
			await deps.onSuccess?.(result.timestamp);
		} else {
			const filename = generateBackupFilename();
			const saved = await deps.desktop.saveFile(filename, content, JSON_BACKUP_FILTERS);
			if (!saved) {
				return { ok: false, error: 'Update blocked because backup was not saved.' };
			}
			await deps.onSuccess?.(new Date().toISOString());
		}

		return { ok: true };
	} catch (error) {
		return { ok: false, error: formatBackupError(error) };
	}
}
