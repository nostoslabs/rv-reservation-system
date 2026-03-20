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

	test('main page relies on automatic persistence instead of a manual save button', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('Changes save automatically')).toBeVisible();
		await expect(page.locator('.toolbar-right button:has-text("Save")')).toHaveCount(0);
	});
});
