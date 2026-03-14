import { test, expect, type Page } from '@playwright/test';

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

async function unlockAdmin(page: Page, passcode: string) {
	await page.goto('/admin');
	await page.fill('input[type="password"]', passcode);
	await page.click('button:has-text("Save Passcode")');
}

async function goToAdminAndUnlock(page: Page, passcode: string) {
	await page.goto('/admin');
	await page.fill('input[type="password"]', passcode);
	await page.click('button:has-text("Unlock")');
}

test.describe('Admin page', () => {
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

	test('admin page has back link to main schedule', async ({ page }) => {
		await page.goto('/admin');

		const backLink = page.locator('[data-testid="back-to-schedule"]');
		await expect(backLink).toBeVisible();
		await expect(backLink).toHaveAttribute('href', '/');

		// Click navigates back to main page
		await backLink.click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('.toolbar-title')).toBeVisible();
	});

	test('admin page does not describe itself as hidden', async ({ page }) => {
		await page.goto('/admin');

		// Should say "Park Settings", not "Admin"
		await expect(page.locator('h1')).toHaveText('Park Settings');

		// Should not contain "hidden" language
		const headerText = await page.locator('.admin-header').textContent();
		expect(headerText?.toLowerCase()).not.toContain('hidden');
		expect(headerText?.toLowerCase()).not.toContain('secret');
		expect(headerText?.toLowerCase()).not.toContain('not linked');
	});

	test('set initial passcode and change site name', async ({ page }) => {
		await page.goto('/admin');

		// No passcode set yet, should see "Set Admin Passcode"
		await expect(page.locator('h2:has-text("Set Admin Passcode")')).toBeVisible();

		// Set a passcode
		await page.fill('input[type="password"]', 'test123');
		await page.click('button:has-text("Save Passcode")');

		// Should now be unlocked and see Site Name section
		await expect(page.locator('h2:has-text("Site Name")')).toBeVisible();

		// Change site name
		const siteNameInput = page.locator('label:has-text("Site Name") input');
		await siteNameInput.fill('My RV Park');
		await page.click('button:has-text("Save Site Name")');

		// Should see success message
		await expect(page.locator('.message.success')).toContainText('Site name updated');
	});

	test('passcode protection works on return visit', async ({ page }) => {
		await page.goto('/admin');

		// Set passcode
		await page.fill('input[type="password"]', 'mypass');
		await page.click('button:has-text("Save Passcode")');

		// Navigate away and come back
		await page.goto('/');
		await page.goto('/admin');

		// Should see passcode prompt
		await expect(page.locator('h2:has-text("Enter Passcode")')).toBeVisible();

		// Wrong passcode
		await page.fill('input[type="password"]', 'wrong');
		await page.click('button:has-text("Unlock")');
		await expect(page.locator('.message.error')).toContainText('Incorrect passcode');

		// Correct passcode
		await page.fill('input[type="password"]', 'mypass');
		await page.click('button:has-text("Unlock")');

		// Should now be unlocked
		await expect(page.locator('h2:has-text("Site Name")')).toBeVisible();
	});

	test('change passcode', async ({ page }) => {
		await page.goto('/admin');

		// Set initial passcode
		await page.fill('input[type="password"]', 'old123');
		await page.click('button:has-text("Save Passcode")');

		// Change passcode
		await expect(page.locator('h2:has-text("Change Passcode")')).toBeVisible();
		const newPassInput = page.locator('label:has-text("New Passcode") input');
		await newPassInput.fill('new456');
		await page.click('button:has-text("Update Passcode")');
		await expect(page.locator('.message.success')).toContainText('Passcode updated');

		// Navigate away and verify new passcode works
		await page.goto('/');
		await page.goto('/admin');
		await page.fill('input[type="password"]', 'new456');
		await page.click('button:has-text("Unlock")');
		await expect(page.locator('h2:has-text("Site Name")')).toBeVisible();
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
		await expect(page.getByTestId('sites-unlock-form')).not.toBeVisible();
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

test.describe('Site management on admin page', () => {
	test.beforeEach(async ({ page }) => {
		await clearStorage(page);
	});

	test('sites management panel is visible on admin page when no passcode', async ({ page }) => {
		await page.goto('/admin');

		// When no passcode is set, should see sites management
		await expect(page.locator('[data-testid="sites-management"]')).toBeVisible();
		await expect(page.locator('h2:has-text("Sites")')).toBeVisible();
	});

	test('sites management panel is visible after unlock with passcode', async ({ page }) => {
		await unlockAdmin(page, 'test123');

		// Should see sites management section
		await expect(page.locator('[data-testid="sites-management"]')).toBeVisible();
		await expect(page.locator('h2:has-text("Sites")')).toBeVisible();
	});

	test('sites management is hidden when locked', async ({ page }) => {
		// Set passcode
		await unlockAdmin(page, 'secret');

		// Navigate away and come back (now locked)
		await page.goto('/');
		await page.goto('/admin');

		// Should see passcode prompt but NOT sites management
		await expect(page.locator('h2:has-text("Enter Passcode")')).toBeVisible();
		await expect(page.locator('[data-testid="sites-management"]')).not.toBeVisible();
	});

	test('add a new site from admin page', async ({ page }) => {
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

	test('rename a site from admin page', async ({ page }) => {
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

	test('delete a site from admin page', async ({ page }) => {
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
