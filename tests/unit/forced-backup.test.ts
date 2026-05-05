import { describe, it, expect, vi } from 'vitest';
import { createForcedBackup, JSON_BACKUP_FILTERS } from '$lib/app/forced-backup';
import type { DesktopCapabilities } from '$lib/application/ports';

function makeDesktop(overrides: Partial<DesktopCapabilities> = {}): DesktopCapabilities {
	return {
		isDesktop: true,
		getAppDataDir: async () => null,
		getVersion: async () => null,
		saveFile: async () => false,
		openFile: async () => null,
		writeFileToPath: async () => {},
		readFileFromPath: async () => '',
		pickDirectory: async () => null,
		checkForUpdate: async () => null,
		checkBetaUpdate: async () => null,
		downloadUpdate: async () => false,
		installUpdateAndRestart: async () => false,
		relaunch: async () => {},
		...overrides
	};
}

describe('createForcedBackup', () => {
	it('writes to the configured backup directory and records success', async () => {
		const writeFileToPath = vi.fn(async (_path: string, _content: string) => {});
		const readFileFromPath = vi.fn(async () => '{"ok":true}');
		const onSuccess = vi.fn(async () => {});

		const result = await createForcedBackup({
			desktop: makeDesktop({ writeFileToPath, readFileFromPath }),
			getBackupContent: () => '{"ok":true}',
			getAutoBackupDirectory: () => '/backups',
			onSuccess
		});

		expect(result.ok).toBe(true);
		expect(writeFileToPath).toHaveBeenCalledOnce();
		const [path, content] = writeFileToPath.mock.calls[0];
		expect(path).toMatch(/^\/backups\/rv-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
		expect(content).toBe('{"ok":true}');
		expect(readFileFromPath).toHaveBeenCalledWith(path);
		expect(onSuccess).toHaveBeenCalledOnce();
	});

	it('opens a save dialog when no backup directory is configured', async () => {
		const saveFile = vi.fn(async (_filename: string, _content: string, _filters?: { name: string; extensions: string[] }[]) => true);

		const result = await createForcedBackup({
			desktop: makeDesktop({ saveFile }),
			getBackupContent: () => '{"ok":true}',
			getAutoBackupDirectory: () => null
		});

		expect(result.ok).toBe(true);
		expect(saveFile).toHaveBeenCalledOnce();
		const [filename, content, filters] = saveFile.mock.calls[0];
		expect(filename).toMatch(/^rv-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
		expect(content).toBe('{"ok":true}');
		expect(filters).toEqual(JSON_BACKUP_FILTERS);
	});

	it('blocks when the user cancels the save dialog', async () => {
		const result = await createForcedBackup({
			desktop: makeDesktop({ saveFile: async () => false }),
			getBackupContent: () => '{"ok":true}',
			getAutoBackupDirectory: () => null
		});

		expect(result).toEqual({
			ok: false,
			error: 'Update blocked because backup was not saved.'
		});
	});

	it('blocks when writing the backup fails', async () => {
		const result = await createForcedBackup({
			desktop: makeDesktop({
				writeFileToPath: async () => {
					throw new Error('disk full');
				}
			}),
			getBackupContent: () => '{"ok":true}',
			getAutoBackupDirectory: () => '/backups'
		});

		expect(result).toEqual({
			ok: false,
			error: 'Backup failed: disk full'
		});
	});

	it('does not record success when backup verification fails', async () => {
		const onSuccess = vi.fn(async () => {});

		const result = await createForcedBackup({
			desktop: makeDesktop({
				readFileFromPath: async () => '{"ok":false}'
			}),
			getBackupContent: () => '{"ok":true}',
			getAutoBackupDirectory: () => '/backups',
			onSuccess
		});

		expect(result).toEqual({
			ok: false,
			error: 'Backup verification failed: written file contents did not match generated backup.'
		});
		expect(onSuccess).not.toHaveBeenCalled();
	});
});
