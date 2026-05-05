import { describe, expect, it, vi } from 'vitest';
import { writeVerifiedBackupToDirectory } from '$lib/app/verified-backup';
import type { DesktopCapabilities } from '$lib/application/ports';

function makeDesktop(overrides: Partial<DesktopCapabilities> = {}): DesktopCapabilities {
	const files = new Map<string, string>();
	return {
		isDesktop: true,
		getAppDataDir: async () => null,
		getVersion: async () => null,
		saveFile: async () => false,
		openFile: async () => null,
		writeFileToPath: async (path: string, content: string) => {
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
}

describe('writeVerifiedBackupToDirectory', () => {
	it('writes backup content and verifies it by reading the file back', async () => {
		const writeFileToPath = vi.fn(async () => {});
		const readFileFromPath = vi.fn(async () => '{"ok":true}');

		const result = await writeVerifiedBackupToDirectory({
			desktop: makeDesktop({ writeFileToPath, readFileFromPath }),
			directoryPath: '/backups',
			getBackupContent: () => '{"ok":true}',
			now: () => new Date('2026-05-04T12:00:00.000Z')
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.error);
		expect(result.timestamp).toBe('2026-05-04T12:00:00.000Z');
		expect(result.filePath).toMatch(/^\/backups\/rv-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
		expect(writeFileToPath).toHaveBeenCalledWith(result.filePath, '{"ok":true}');
		expect(readFileFromPath).toHaveBeenCalledWith(result.filePath);
	});

	it('fails when writing throws', async () => {
		const result = await writeVerifiedBackupToDirectory({
			desktop: makeDesktop({
				writeFileToPath: async () => {
					throw new Error('disk full');
				}
			}),
			directoryPath: '/backups',
			getBackupContent: () => '{"ok":true}'
		});

		expect(result).toEqual({ ok: false, error: 'Backup failed: disk full' });
	});

	it('fails when read-back content differs from generated content', async () => {
		const result = await writeVerifiedBackupToDirectory({
			desktop: makeDesktop({
				readFileFromPath: async () => '{"ok":false}'
			}),
			directoryPath: '/backups',
			getBackupContent: () => '{"ok":true}'
		});

		expect(result).toEqual({
			ok: false,
			error: 'Backup verification failed: written file contents did not match generated backup.'
		});
	});

	it('preserves existing trailing path separators', async () => {
		const paths: string[] = [];

		const result = await writeVerifiedBackupToDirectory({
			desktop: makeDesktop({
				writeFileToPath: async (path, _content) => {
					paths.push(path);
				},
				readFileFromPath: async () => '{"ok":true}'
			}),
			directoryPath: '/backups/',
			getBackupContent: () => '{"ok":true}'
		});

		expect(result.ok).toBe(true);
		expect(paths[0]).toMatch(/^\/backups\/rv-backup-/);
		expect(paths[0]).not.toContain('//');
	});
});
