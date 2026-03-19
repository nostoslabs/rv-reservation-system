/**
 * Migrate the SQLite database from the old app identifier (rv-reservation-demo)
 * to the new one (rv-reservation-system) if it exists and the new DB is empty.
 *
 * This runs once on Tauri startup before the database is opened.
 */
export async function migrateLegacyDatabase(): Promise<void> {
	try {
		const { appDataDir } = await import('@tauri-apps/api/path');
		const { exists, copyFile, mkdir } = await import('@tauri-apps/plugin-fs');

		const newDir = await appDataDir();
		const newDbPath = `${newDir}rv-reservations.db`;

		// Derive the old path by replacing the identifier in the directory
		const oldDir = newDir.replace(
			'com.nostoslabs.rv-reservation-system',
			'com.nostoslabs.rv-reservation-demo'
		);
		const oldDbPath = `${oldDir}rv-reservations.db`;

		// Only migrate if old DB exists
		const oldExists = await exists(oldDbPath);
		if (!oldExists) return;

		// Only migrate if new DB does NOT exist (don't overwrite)
		const newExists = await exists(newDbPath);
		if (newExists) return;

		// Ensure new directory exists
		await mkdir(newDir, { recursive: true }).catch(() => {});

		await copyFile(oldDbPath, newDbPath);
		console.log(`Migrated legacy database from ${oldDbPath} to ${newDbPath}`);
	} catch (err) {
		// Non-fatal — if migration fails, the app starts with a fresh DB
		console.warn('Legacy database migration skipped:', err);
	}
}
