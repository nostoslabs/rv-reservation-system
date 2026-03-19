import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function clearStorage(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
}

async function resetApp(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
	await page.reload();
	await page.waitForSelector('.toolbar-title');
	await page.waitForTimeout(300);
}

test.describe('Settings page', () => {
	test.beforeEach(async ({ page }) => {
		await clearStorage(page);
	});

	test('gear icon on main page navigates to settings', async ({ page }) => {
		await page.goto('/');

		// Gear icon should be visible
		const settingsLink = page.locator('[data-testid="settings-link"]');
		await expect(settingsLink).toBeVisible();
		await expect(settingsLink).toHaveAttribute('href', '/admin');
		await expect(settingsLink).toHaveAttribute('aria-label', 'Settings');

		// Click navigates to /admin
		await settingsLink.click();
		await expect(page).toHaveURL(/\/admin$/);
		await expect(page.locator('h1')).toHaveText('Park Settings');
	});

	test('settings page has back link to main schedule', async ({ page }) => {
		await page.goto('/admin');

		const backLink = page.locator('[data-testid="back-to-schedule"]');
		await expect(backLink).toBeVisible();
		await expect(backLink).toHaveAttribute('href', '/');

		// Click navigates back to main page
		await backLink.click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('.toolbar-title')).toBeVisible();
	});

	test('settings page does not describe itself as hidden', async ({ page }) => {
		await page.goto('/admin');

		// Should say "Park Settings", not "Admin"
		await expect(page.locator('h1')).toHaveText('Park Settings');

		// Should not contain "hidden" language
		const headerText = await page.locator('.admin-header').textContent();
		expect(headerText?.toLowerCase()).not.toContain('hidden');
		expect(headerText?.toLowerCase()).not.toContain('secret');
		expect(headerText?.toLowerCase()).not.toContain('not linked');
	});

	test('change site name', async ({ page }) => {
		await page.goto('/admin');

		// Site Name section should be immediately visible (no passcode needed)
		await expect(page.locator('h2:has-text("Site Name")')).toBeVisible();

		// Change site name
		const siteNameInput = page.locator('label:has-text("Site Name") input');
		await siteNameInput.fill('My RV Park');
		await page.click('button:has-text("Save Site Name")');

		// Should see success message
		await expect(page.locator('.message.success')).toContainText('Site name updated');
	});
});

test.describe('Main page has no sites panel', () => {
	test.beforeEach(async ({ page }) => {
		await clearStorage(page);
	});

	test('main page does not show site management sidebar', async ({ page }) => {
		await resetApp(page);

		// The ParkingLocationsPanel should NOT be present on the main page
		await expect(page.locator('#parking-locations-title')).not.toBeVisible();
		await expect(page.locator('.add-form')).not.toBeVisible();
	});

	test('main page schedule uses full width without sidebar', async ({ page }) => {
		await resetApp(page);

		// The layout should not have the two-column aside + section grid
		const aside = page.locator('.layout-grid > aside');
		await expect(aside).toHaveCount(0);

		// The sheet-panel should be directly in the layout
		await expect(page.locator('.sheet-panel')).toBeVisible();
	});
});

test.describe('Backup & Restore section on settings page', () => {
	test.beforeEach(async ({ page }) => {
		await clearStorage(page);
	});

	test('export button is visible on settings page', async ({ page }) => {
		await page.goto('/admin');
		const exportBtn = page.locator('[data-testid="backup-export-btn"]');
		await expect(exportBtn).toBeVisible();
		await expect(exportBtn).toContainText('Export');
	});

	test('restore button is visible on settings page', async ({ page }) => {
		await page.goto('/admin');

		const importBtn = page.locator('[data-testid="backup-import-btn"]');
		await expect(importBtn).toBeVisible();
		await expect(importBtn).toContainText('Restore Backup');
	});

	test('backup panel has correct heading', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.locator('h2:has-text("Backup & Restore")')).toBeVisible();
	});
});

test.describe('Site management on settings page', () => {
	test.beforeEach(async ({ page }) => {
		await clearStorage(page);
	});

	test('sites management panel is always visible on settings page', async ({ page }) => {
		await page.goto('/admin');

		// Sites management should always be visible
		await expect(page.locator('[data-testid="sites-management"]')).toBeVisible();
		await expect(page.locator('h2:has-text("Sites")')).toBeVisible();
	});

	test('add a new site from settings page', async ({ page }) => {
		await page.goto('/admin');

		// Add a site with a unique name
		const addInput = page.locator('[data-testid="sites-management"] input[placeholder="Add site"]');
		await addInput.fill('New-Test-Site');
		await page.locator('[data-testid="sites-management"] button:has-text("Add")').click();

		// Site should appear in the list
		await expect(page.locator('[data-testid="sites-management"]')).toContainText('New-Test-Site');

		// Go to main page and verify the site appears as a row
		await page.goto('/');
		await page.waitForSelector('.toolbar-title');
		await expect(page.locator('.location-cell:has-text("New-Test-Site")')).toBeVisible();
	});

	test('rename a site from settings page', async ({ page }) => {
		await page.goto('/admin');

		// Add a site with a unique name
		const addInput = page.locator('[data-testid="sites-management"] input[placeholder="Add site"]');
		await addInput.fill('Rename-Test');
		await page.locator('[data-testid="sites-management"] button:has-text("Add")').click();
		await expect(page.locator('[data-testid="sites-management"]')).toContainText('Rename-Test');

		// Click kebab menu for Rename-Test
		await page.locator('[data-testid="sites-management"] button[aria-label="Actions for Rename-Test"]').click();
		await page.locator('[data-testid="sites-management"] button:has-text("Rename")').click();

		// Rename to Renamed-Site
		const renameInput = page.locator('[data-testid="sites-management"] .location-row.editing input');
		await renameInput.fill('Renamed-Site');
		await page.locator('[data-testid="sites-management"] button.save-btn').click();

		// Should show new name
		await expect(page.locator('[data-testid="sites-management"]')).toContainText('Renamed-Site');
		await expect(page.locator('[data-testid="sites-management"]')).not.toContainText('Rename-Test');
	});

	test('delete a site from settings page', async ({ page }) => {
		await page.goto('/admin');

		// Add a site with a unique name
		const addInput = page.locator('[data-testid="sites-management"] input[placeholder="Add site"]');
		await addInput.fill('Delete-Me');
		await page.locator('[data-testid="sites-management"] button:has-text("Add")').click();
		await expect(page.locator('[data-testid="sites-management"]')).toContainText('Delete-Me');

		// Click kebab menu and delete
		await page.locator('[data-testid="sites-management"] button[aria-label="Actions for Delete-Me"]').click();
		await page.locator('[data-testid="sites-management"] button:has-text("Delete")').click();

		// Confirm deletion
		await page.locator('[data-testid="sites-management"] button:has-text("Yes")').click();

		// Site should be gone
		await expect(page.locator('[data-testid="sites-management"]')).not.toContainText('Delete-Me');
	});
});

test.describe('Backup export/import functional tests', () => {
	test.beforeEach(async ({ page }) => {
		await clearStorage(page);
	});

	test('export produces a valid backup JSON file', async ({ page }) => {
		await page.goto('/admin');

		// Set a known site name first
		const siteNameInput = page.locator('label:has-text("Site Name") input');
		await siteNameInput.fill('Export Test Park');
		await page.click('button:has-text("Save Site Name")');
		await expect(page.locator('.message.success')).toBeVisible();

		// Click export and capture the download
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.click('[data-testid="backup-export-btn"]')
		]);

		expect(download.suggestedFilename()).toMatch(/^rv-backup-\d{4}-\d{2}-\d{2}\.json$/);

		// Read and validate the backup content
		const filePath = await download.path();
		expect(filePath).toBeTruthy();
		const content = fs.readFileSync(filePath!, 'utf8');
		const backup = JSON.parse(content);

		expect(backup.schema.version).toBe(1);
		expect(backup.schema.appName).toBe('rv-reservation-system');
		expect(backup.schema.exportedAt).toBeTruthy();
		expect(Array.isArray(backup.data.reservations)).toBe(true);
		expect(Array.isArray(backup.data.parkingLocations)).toBe(true);
		expect(Array.isArray(backup.data.customers)).toBe(true);
		expect(backup.data.siteSettings.siteName).toBe('Export Test Park');

		// Success message should be shown
		await expect(page.locator('.message.success')).toContainText('Backup exported successfully');
	});

	test('import restores data from a backup file', async ({ page }) => {
		// Create a backup file with known data
		const backup = {
			schema: { version: 1, appName: 'rv-reservation-system', exportedAt: new Date().toISOString() },
			data: {
				reservations: [
					{
						index: 1,
						firstCellId: 'Import-Site_2025-07-01',
						name: 'Imported Guest',
						phoneNumber: '555-0000',
						notes: 'from backup',
						startDate: '2025-07-01',
						endDate: '2025-07-03',
						parkingLocation: 'Import-Site',
						color: 'blue',
						status: 'reserved'
					}
				],
				parkingLocations: ['Import-Site'],
				siteSettings: { siteName: 'Restored Park', compactView: false },
				customers: [
					{
						id: 'imported-c1',
						name: 'Backup Customer',
						phone: '555-1111',
						email: 'backup@test.com',
						notes: '',
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z'
					}
				]
			}
		};

		const tmpFile = path.join('test-results', 'test-backup-import.json');
		fs.mkdirSync('test-results', { recursive: true });
		fs.writeFileSync(tmpFile, JSON.stringify(backup));

		await page.goto('/admin');

		// Intercept the desktop.openFile call by injecting the backup content
		// Since web fallback opens a file input, we override via page.evaluate
		await page.evaluate((backupJson: string) => {
			// Override the file input click to auto-populate
			const origCreateElement = document.createElement.bind(document);
			document.createElement = function (tag: string, options?: ElementCreationOptions) {
				const el = origCreateElement(tag, options);
				if (tag === 'input' && !el.dataset._patched) {
					el.dataset._patched = 'true';
					const origClick = el.click.bind(el);
					el.click = function () {
						// Create a File from the backup JSON and set it on the input
						const file = new File([backupJson], 'test-backup.json', { type: 'application/json' });
						const dt = new DataTransfer();
						dt.items.add(file);
						Object.defineProperty(el, 'files', { value: dt.files, writable: false });
						el.dispatchEvent(new Event('change', { bubbles: true }));
					};
				}
				return el;
			} as typeof document.createElement;
		}, JSON.stringify(backup));

		// Accept the confirmation dialog
		page.on('dialog', (dialog) => dialog.accept());

		// Click restore
		await page.click('[data-testid="backup-import-btn"]');

		// Wait for success message
		await expect(page.locator('.message.success')).toContainText('Backup restored successfully');
		await expect(page.locator('.message.success')).toContainText('1 reservations');
		await expect(page.locator('.message.success')).toContainText('1 customers');

		// Verify site name was restored
		const siteNameInput = page.locator('label:has-text("Site Name") input');
		await expect(siteNameInput).toHaveValue('Restored Park');

		// Navigate to main page and verify site appears
		await page.goto('/');
		await page.waitForSelector('.toolbar-title');
		await expect(page.locator('.toolbar-title')).toContainText('Restored Park');
		await expect(page.locator('.location-cell:has-text("Import-Site")')).toBeVisible();

		// Clean up
		fs.unlinkSync(tmpFile);
	});
});
