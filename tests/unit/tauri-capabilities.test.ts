import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function loadPermissions(): string[] {
	const capabilitiesPath = path.resolve('src-tauri/capabilities/default.json');
	const capabilities = JSON.parse(fs.readFileSync(capabilitiesPath, 'utf-8')) as {
		permissions?: string[];
	};
	return capabilities.permissions ?? [];
}

describe('Tauri desktop capabilities', () => {
	it('includes fs plugin permissions for backup import/export', () => {
		const permissions = loadPermissions();
		expect(permissions).toContain('fs:default');
	});

	it('includes window-state plugin for persisting window size and position', () => {
		const permissions = loadPermissions();
		expect(permissions).toContain('window-state:default');
	});
});
