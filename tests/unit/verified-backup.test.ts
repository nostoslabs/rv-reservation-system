import { describe, expect, it, vi } from 'vitest';
import { writeVerifiedBackupToDirectory } from '$lib/app/verified-backup';
import { createDesktopCapabilitiesMock } from './desktop-capabilities.fixture';

	describe('writeVerifiedBackupToDirectory', () => {
		it('writes backup content and verifies it by reading the file back', async () => {
			const writeFileToPath = vi.fn(async (_path: string, _content: string) => {});
			const readFileFromPath = vi.fn(async (_path: string) => '{"ok":true}');

		const result = await writeVerifiedBackupToDirectory({
			desktop: createDesktopCapabilitiesMock({ writeFileToPath, readFileFromPath }).desktop,
			directoryPath: '/backups',
			getBackupContent: () => '{"ok":true}',
			now: () => new Date('2026-05-04T12:00:00.000Z')
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.error);
		expect(result.timestamp).toBe('2026-05-04T12:00:00.000Z');
		const [filePath] = writeFileToPath.mock.calls[0];
		expect(filePath).toMatch(/^\/backups\/rv-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
		expect(writeFileToPath).toHaveBeenCalledWith(filePath, '{"ok":true}');
		expect(readFileFromPath).toHaveBeenCalledWith(filePath);
	});

	it('fails when writing throws', async () => {
		const result = await writeVerifiedBackupToDirectory({
			desktop: createDesktopCapabilitiesMock({
				writeFileToPath: async () => {
					throw new Error('disk full');
				}
			}).desktop,
			directoryPath: '/backups',
			getBackupContent: () => '{"ok":true}'
		});

		expect(result).toEqual({ ok: false, error: 'Backup failed: disk full' });
	});

	it('fails when read-back content differs from generated content', async () => {
		const result = await writeVerifiedBackupToDirectory({
			desktop: createDesktopCapabilitiesMock({
				readFileFromPath: async () => '{"ok":false}'
			}).desktop,
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
			desktop: createDesktopCapabilitiesMock({
				writeFileToPath: async (path, _content) => {
					paths.push(path);
				},
				readFileFromPath: async () => '{"ok":true}'
			}).desktop,
			directoryPath: '/backups/',
			getBackupContent: () => '{"ok":true}'
		});

		expect(result.ok).toBe(true);
		expect(paths[0]).toMatch(/^\/backups\/rv-backup-/);
		expect(paths[0]).not.toContain('//');
	});
});
