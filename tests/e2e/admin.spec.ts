import { test, expect, type Page } from '@playwright/test';

async function clearStorage(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
}

test.describe('Admin page', () => {
	test.beforeEach(async ({ page }) => {
		await clearStorage(page);
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
