import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

type PermissionEntry = string | { identifier: string; allow?: string[] };

function loadPermissions(): PermissionEntry[] {
	const capabilitiesPath = path.resolve('src-tauri/capabilities/default.json');
	const capabilities = JSON.parse(fs.readFileSync(capabilitiesPath, 'utf-8')) as {
		permissions?: PermissionEntry[];
	};
	return capabilities.permissions ?? [];
}

function hasPermission(permissions: PermissionEntry[], id: string): boolean {
	return permissions.some((p) =>
		typeof p === 'string' ? p === id : p.identifier === id
	);
}

describe('Tauri desktop capabilities', () => {
	it('includes fs read and write permissions for backup import/export', () => {
		const permissions = loadPermissions();
		expect(hasPermission(permissions, 'fs:default')).toBe(true);
		expect(hasPermission(permissions, 'fs:read-files')).toBe(true);
		expect(hasPermission(permissions, 'fs:write-files')).toBe(true);
	});

	it('includes fs scope for user-accessible paths', () => {
		const permissions = loadPermissions();
		const scope = permissions.find(
			(p) => typeof p === 'object' && p.identifier === 'fs:scope'
		);
		expect(scope).toBeDefined();
		expect((scope as { allow?: string[] }).allow).toContain('$HOME/**');
	});

	it('includes window-state plugin for persisting window size and position', () => {
		const permissions = loadPermissions();
		expect(hasPermission(permissions, 'window-state:default')).toBe(true);
	});
});
