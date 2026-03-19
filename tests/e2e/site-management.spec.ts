import { test, expect, type Page } from '@playwright/test';

async function resetApp(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
	await page.reload();
	await page.waitForSelector('.toolbar-title');
}

/** Get the ordered list of location names from the main page grid. */
async function getGridLocations(page: Page): Promise<string[]> {
	return page.locator('.location-cell').allTextContents();
}

/** Get the ordered list of location names from the settings panel. */
async function getSettingsLocations(page: Page): Promise<string[]> {
	return page.locator('[data-testid="sites-management"] .location-name').allTextContents();
}

test.describe('Site management persistence', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('added site appears on main page after navigation', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		const addInput = page.locator('[data-testid="sites-management"] input[placeholder="Add site"]');
		await addInput.fill('New-Persist-Test');
		await page.locator('[data-testid="sites-management"] button:has-text("Add")').click();
		await expect(page.locator('[data-testid="sites-management"]')).toContainText('New-Persist-Test');

		// Navigate back via link
		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');

		await expect(page.locator('.location-cell:has-text("New-Persist-Test")')).toBeVisible();
	});

	test('added site persists after full page reload', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		const addInput = page.locator('[data-testid="sites-management"] input[placeholder="Add site"]');
		await addInput.fill('Reload-Add-Test');
		await page.locator('[data-testid="sites-management"] button:has-text("Add")').click();

		await page.goto('/');
		await page.waitForSelector('.toolbar-title');

		await expect(page.locator('.location-cell:has-text("Reload-Add-Test")')).toBeVisible();
	});

	test('renamed site persists after SPA navigation', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Rename A-01 → Renamed-SPA
		await page.locator('button[aria-label="Actions for A-01"]').click();
		await page.locator('button:has-text("Rename")').click();
		const renameInput = page.locator('.location-row.editing input');
		await renameInput.fill('Renamed-SPA');
		await page.locator('button.save-btn').click();

		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');

		await expect(page.locator('.location-cell:has-text("Renamed-SPA")')).toBeVisible();
		await expect(page.locator('.location-cell:has-text("A-01")')).not.toBeVisible();
	});

	test('renamed site persists after full page reload', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		await page.locator('button[aria-label="Actions for A-01"]').click();
		await page.locator('button:has-text("Rename")').click();
		await page.locator('.location-row.editing input').fill('Renamed-Reload');
		await page.locator('button.save-btn').click();

		await page.goto('/');
		await page.waitForSelector('.toolbar-title');

		await expect(page.locator('.location-cell:has-text("Renamed-Reload")')).toBeVisible();
		await expect(page.locator('.location-cell:has-text("A-01")')).not.toBeVisible();
	});

	test('deleted site is gone after navigation', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Delete Overflow (no reservations)
		await page.locator('button[aria-label="Actions for Overflow"]').click();
		await page.locator('button:has-text("Delete")').click();
		await page.locator('button:has-text("Yes")').click();
		await expect(page.locator('[data-testid="sites-management"]')).not.toContainText('Overflow');

		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');

		await expect(page.locator('.location-cell:has-text("Overflow")')).not.toBeVisible();
	});
});

test.describe('Site reorder persistence', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('reorder via Move Down persists on main page', async ({ page }) => {
		// Get initial order on main page
		const initialOrder = await getGridLocations(page);
		expect(initialOrder[0]).toBe('A-01');
		expect(initialOrder[1]).toBe('A-02');

		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Move A-01 down via kebab menu
		await page.locator('button[aria-label="Actions for A-01"]').click();
		await page.locator('button:has-text("Move Down")').click();

		// Verify settings panel order changed
		const settingsOrder = await getSettingsLocations(page);
		expect(settingsOrder[0]).toBe('A-02');
		expect(settingsOrder[1]).toBe('A-01');

		// Navigate back and verify grid order
		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');

		const newOrder = await getGridLocations(page);
		expect(newOrder[0]).toBe('A-02');
		expect(newOrder[1]).toBe('A-01');
	});

	test('reorder via Move Up persists on main page', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Move A-02 up via kebab menu
		await page.locator('button[aria-label="Actions for A-02"]').click();
		await page.locator('button:has-text("Move Up")').click();

		const settingsOrder = await getSettingsLocations(page);
		expect(settingsOrder[0]).toBe('A-02');
		expect(settingsOrder[1]).toBe('A-01');

		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');

		const newOrder = await getGridLocations(page);
		expect(newOrder[0]).toBe('A-02');
		expect(newOrder[1]).toBe('A-01');
	});

	test('reorder persists after full page reload', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Move A-01 down
		await page.locator('button[aria-label="Actions for A-01"]').click();
		await page.locator('button:has-text("Move Down")').click();

		// Full reload
		await page.goto('/');
		await page.waitForSelector('.toolbar-title');

		const order = await getGridLocations(page);
		expect(order[0]).toBe('A-02');
		expect(order[1]).toBe('A-01');
	});

	test('multiple reorders persist correctly', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Move A-01 down twice (A-01 → position 3)
		await page.locator('button[aria-label="Actions for A-01"]').click();
		await page.locator('button:has-text("Move Down")').click();
		await page.locator('button[aria-label="Actions for A-01"]').click();
		await page.locator('button:has-text("Move Down")').click();

		const settingsOrder = await getSettingsLocations(page);
		expect(settingsOrder[0]).toBe('A-02');
		expect(settingsOrder[1]).toBe('A-03');
		expect(settingsOrder[2]).toBe('A-01');

		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');

		const gridOrder = await getGridLocations(page);
		expect(gridOrder[0]).toBe('A-02');
		expect(gridOrder[1]).toBe('A-03');
		expect(gridOrder[2]).toBe('A-01');
	});

	test('Move Up is hidden for first item', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Open kebab for first item
		const firstLocation = await page.locator('[data-testid="sites-management"] .location-name').first().textContent();
		await page.locator(`button[aria-label="Actions for ${firstLocation}"]`).click();

		// Move Up should not be visible
		await expect(page.locator('.kebab-menu button:has-text("Move Up")')).not.toBeVisible();
		// Move Down should be visible
		await expect(page.locator('.kebab-menu button:has-text("Move Down")')).toBeVisible();
	});

	test('Move Down is hidden for last item', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForSelector('[data-testid="sites-management"]');

		// Open kebab for last item
		const lastLocation = await page.locator('[data-testid="sites-management"] .location-name').last().textContent();
		await page.locator(`button[aria-label="Actions for ${lastLocation}"]`).click();

		// Move Down should not be visible
		await expect(page.locator('.kebab-menu button:has-text("Move Down")')).not.toBeVisible();
		// Move Up should be visible
		await expect(page.locator('.kebab-menu button:has-text("Move Up")')).toBeVisible();
	});
});
