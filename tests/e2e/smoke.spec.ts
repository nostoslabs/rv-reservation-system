import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
	test('main page loads and shows Working Sheet', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.locator('#working-sheet-title')).toHaveText('Working Sheet');
	});

	test('admin page loads', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.locator('h1')).toHaveText('Admin');
	});
});
