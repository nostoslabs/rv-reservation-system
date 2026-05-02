import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const scriptPath = 'scripts/release-guard.mjs';

function release(overrides: Record<string, unknown> = {}) {
	return {
		tag_name: 'v1.19.4-beta.1',
		draft: false,
		prerelease: true,
		assets: [
			{ name: 'RV Reservation System_1.19.4_universal.dmg' },
			{ name: 'RV Reservation System_1.19.4_x64_en-US.msi' }
		],
		...overrides
	};
}

async function runGuard(tag: string, releases: unknown[] = []) {
	return await execFileAsync('node', [scriptPath, '--tag', tag], {
		cwd: process.cwd(),
		env: {
			...process.env,
			RELEASE_GUARD_RELEASES_JSON: JSON.stringify(releases)
		}
	});
}

async function expectGuardFailure(tag: string, releases: unknown[] = []) {
	try {
		await runGuard(tag, releases);
		throw new Error('Expected release guard to fail');
	} catch (error) {
		if (error instanceof Error && error.message === 'Expected release guard to fail') {
			throw error;
		}
		return error as { stdout: string; stderr: string };
	}
}

describe('release guard', () => {
	it('skips prerelease tags', async () => {
		const { stdout } = await runGuard('v1.19.4-beta.1');

		expect(stdout).toContain('does not require prior beta verification');
	});

	it('allows stable tags when a published matching beta has macOS and Windows assets', async () => {
		const { stdout } = await runGuard('v1.19.4', [release()]);

		expect(stdout).toContain('Found qualifying beta prerelease v1.19.4-beta.1');
	});

	it('rejects stable tags without a matching beta prerelease', async () => {
		const error = await expectGuardFailure('v1.19.4', [release({ tag_name: 'v1.19.3-beta.1' })]);

		expect(error.stderr).toContain('No qualifying beta prerelease found for v1.19.4');
	});

	it('rejects draft beta releases because they were not published for testing', async () => {
		const error = await expectGuardFailure('v1.19.4', [release({ draft: true })]);

		expect(error.stderr).toContain('No qualifying beta prerelease found for v1.19.4');
	});

	it('rejects beta releases that do not include both desktop platform artifacts', async () => {
		const error = await expectGuardFailure('v1.19.4', [
			release({ assets: [{ name: 'RV Reservation System_1.19.4_universal.dmg' }] })
		]);

		expect(error.stderr).toContain('No qualifying beta prerelease found for v1.19.4');
	});
});
