import { test, expect, type Page } from '@playwright/test';

async function resetApp(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
	await page.reload();
	await page.waitForSelector('.toolbar-title');
	await page.waitForTimeout(300);
}

test.describe('Site colors', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('color swatch buttons appear in site management panel', async ({ page }) => {
		await page.click('[data-testid="settings-link"]');
		await page.waitForURL(/\/admin$/);
		await page.waitForSelector('[data-testid="sites-management"]');
		await page.waitForTimeout(500);

		// Each site row should have a color swatch button
		const swatches = page.locator('[data-testid="sites-management"] .color-swatch-btn');
		const count = await swatches.count();
		expect(count).toBeGreaterThan(0);
	});

	test('clicking color swatch opens preset picker', async ({ page }) => {
		await page.click('[data-testid="settings-link"]');
		await page.waitForURL(/\/admin$/);
		await page.waitForSelector('[data-testid="sites-management"]');
		await page.waitForTimeout(500);

		// Click the first site's color swatch
		const firstSwatch = page.locator('.color-swatch-btn').first();
		await firstSwatch.click();

		// Color picker dropdown should appear
		const picker = page.locator('.color-picker-dropdown');
		await expect(picker).toBeVisible();

		// Should have 10 preset color options
		const options = picker.locator('.color-option:not(.clear-color)');
		await expect(options).toHaveCount(10);
	});

	test('selecting a color applies it to the site row in grid', async ({ page }) => {
		await page.click('[data-testid="settings-link"]');
		await page.waitForURL(/\/admin$/);
		await page.waitForSelector('[data-testid="sites-management"]');
		await page.waitForTimeout(500);

		// Click the first site's color swatch and pick a color
		await page.locator('.color-swatch-btn').first().click();
		const picker = page.locator('.color-picker-dropdown');
		await expect(picker).toBeVisible();

		// Click the first preset color
		await picker.locator('.color-option').first().click();
		await expect(picker).toBeHidden();

		// The swatch should now have a background color (no longer has .no-color class)
		const swatch = page.locator('.color-swatch-btn').first();
		const hasNoColor = await swatch.evaluate((el) => el.classList.contains('no-color'));
		expect(hasNoColor).toBe(false);

		// Navigate back to grid and verify the first site row has a colored header
		await page.click('[data-testid="back-to-schedule"]');
		await page.waitForSelector('.toolbar-title');
		await page.waitForTimeout(300);

		const firstLocationCell = page.locator('.location-cell').first();
		const bgColor = await firstLocationCell.evaluate((el) => el.style.backgroundColor);
		expect(bgColor).not.toBe('');
	});

	test('clearing a color removes the tint', async ({ page }) => {
		await page.click('[data-testid="settings-link"]');
		await page.waitForURL(/\/admin$/);

		// Set a color first
		await page.locator('.color-swatch-btn').first().click();
		await page.locator('.color-picker-dropdown .color-option').first().click();
		await page.waitForTimeout(200);

		// Re-open picker and clear the color
		await page.locator('.color-swatch-btn').first().click();
		const clearBtn = page.locator('.color-option.clear-color');
		await expect(clearBtn).toBeVisible();
		await clearBtn.click();

		// Swatch should have .no-color class again
		const swatch = page.locator('.color-swatch-btn').first();
		const hasNoColor = await swatch.evaluate((el) => el.classList.contains('no-color'));
		expect(hasNoColor).toBe(true);
	});

	test('site color persists across page reload', async ({ page }) => {
		await page.click('[data-testid="settings-link"]');
		await page.waitForURL(/\/admin$/);

		// Set a color
		await page.locator('.color-swatch-btn').first().click();
		await page.locator('.color-picker-dropdown .color-option').first().click();
		await page.waitForTimeout(300);

		// Get the swatch's background color
		const colorBefore = await page.locator('.color-swatch-btn').first().evaluate(
			(el) => el.style.backgroundColor
		);

		// Reload
		await page.reload();
		await page.waitForSelector('[data-testid="sites-management"]');
		await page.waitForTimeout(300);

		// Color should persist
		const colorAfter = await page.locator('.color-swatch-btn').first().evaluate(
			(el) => el.style.backgroundColor
		);
		expect(colorAfter).toBe(colorBefore);
	});
});
