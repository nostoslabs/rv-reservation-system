import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
	test('main page loads and shows Schedule', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.locator('#schedule-title')).toHaveText('Schedule');
	});

	test('admin page loads', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.locator('h1')).toHaveText('Park Settings');
	});
});
