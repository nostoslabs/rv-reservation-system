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

test.describe('Sites panel lock (issue #11)', () => {
test.beforeEach(async ({ page }) => {
await clearStorage(page);
});

test('sites panel shows full management UI when no passcode is set', async ({ page }) => {
await resetApp(page);

// Add form and kebab buttons should be visible when no passcode is set
await expect(page.locator('.add-form')).toBeVisible();
});

test('sites panel locks site management when passcode is set', async ({ page }) => {
// Set a passcode via the admin page
await page.goto('/admin');
await page.fill('input[type="password"]', 'secret123');
await page.click('button:has-text("Save Passcode")');

// Go back to main page
await page.goto('/');
await page.waitForSelector('.toolbar-title');
await page.waitForTimeout(300);

// The sites panel should show the unlock form, not the add form
await expect(page.getByTestId('sites-unlock-form')).toBeVisible();
await expect(page.locator('.add-form')).not.toBeVisible();
});

test('sites panel unlocks with correct passcode', async ({ page }) => {
// Set a passcode
await page.goto('/admin');
await page.fill('input[type="password"]', 'unlock123');
await page.click('button:has-text("Save Passcode")');

// Go back to main page
await page.goto('/');
await page.waitForSelector('.toolbar-title');
await page.waitForTimeout(300);

// Enter correct passcode in the panel
await page.getByTestId('sites-passcode-input').fill('unlock123');
await page.getByTestId('sites-unlock-btn').click();

// Management UI should now be visible
await expect(page.locator('.add-form')).toBeVisible();
await expect(page.getByTestId('sites-unlock-form')).not.toBeVisible();
});

test('sites panel rejects incorrect passcode', async ({ page }) => {
// Set a passcode
await page.goto('/admin');
await page.fill('input[type="password"]', 'correctpass');
await page.click('button:has-text("Save Passcode")');

// Go back to main page
await page.goto('/');
await page.waitForSelector('.toolbar-title');
await page.waitForTimeout(300);

// Enter wrong passcode
await page.getByTestId('sites-passcode-input').fill('wrongpass');
await page.getByTestId('sites-unlock-btn').click();

// Should still show unlock form with an error
await expect(page.getByTestId('sites-unlock-form')).toBeVisible();
await expect(page.locator('.unlock-error')).toContainText('Incorrect passcode');
await expect(page.locator('.add-form')).not.toBeVisible();
});

test('unlocked panel shows lock button to re-lock', async ({ page }) => {
// Set a passcode
await page.goto('/admin');
await page.fill('input[type="password"]', 'mypass');
await page.click('button:has-text("Save Passcode")');

// Go back to main page and unlock the panel
await page.goto('/');
await page.waitForSelector('.toolbar-title');
await page.waitForTimeout(300);
await page.getByTestId('sites-passcode-input').fill('mypass');
await page.getByTestId('sites-unlock-btn').click();

// Lock button should be visible
await expect(page.getByTestId('sites-lock-btn')).toBeVisible();

// Click lock button → returns to locked state
await page.getByTestId('sites-lock-btn').click();
await expect(page.getByTestId('sites-unlock-form')).toBeVisible();
await expect(page.locator('.add-form')).not.toBeVisible();
});
});
