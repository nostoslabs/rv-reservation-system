import type { DesktopCapabilities } from '$lib/application/ports';
import { generateBackupFilename } from '$lib/domain/backup';

export type VerifiedBackupResult =
	| { ok: true; filePath: string; timestamp: string }
	| { ok: false; error: string };

export interface VerifiedBackupDeps {
	desktop: DesktopCapabilities;
	directoryPath: string;
	getBackupContent: () => string;
	now?: () => Date;
}

function joinBackupPath(directoryPath: string, filename: string): string {
	const separator = directoryPath.endsWith('/') || directoryPath.endsWith('\\') ? '' : '/';
	return `${directoryPath}${separator}${filename}`;
}

function formatBackupError(error: unknown): string {
	return `Backup failed: ${error instanceof Error ? error.message : String(error)}`;
}

export async function writeVerifiedBackupToDirectory(deps: VerifiedBackupDeps): Promise<VerifiedBackupResult> {
	try {
		const content = deps.getBackupContent();
		const filePath = joinBackupPath(deps.directoryPath, generateBackupFilename());

		await deps.desktop.writeFileToPath(filePath, content);
		const writtenContent = await deps.desktop.readFileFromPath(filePath);
		if (writtenContent !== content) {
			return {
				ok: false,
				error: 'Backup verification failed: written file contents did not match generated backup.'
			};
		}

		return {
			ok: true,
			filePath,
			timestamp: (deps.now?.() ?? new Date()).toISOString()
		};
	} catch (error) {
		return { ok: false, error: formatBackupError(error) };
	}
}
