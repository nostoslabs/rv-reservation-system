import { test, expect, type Page } from '@playwright/test';

async function resetApp(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
	await page.reload();
	await page.waitForSelector('.toolbar-title');
	await page.waitForTimeout(300);
}

async function navigateToCustomers(page: Page) {
	await page.click('[data-testid="customers-link"]');
	await page.waitForURL(/\/customers$/);
}

test.describe('Customer modal sticky header', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('header stays visible when modal content is scrolled', async ({ page }) => {
		await navigateToCustomers(page);

		// Open the add customer modal
		await page.click('[data-testid="add-customer-btn"]');
		await page.waitForSelector('.modal[role="dialog"]');

		// Shrink the viewport so the modal must scroll
		await page.setViewportSize({ width: 800, height: 400 });

		const header = page.locator('.modal-header');
		const modal = page.locator('.modal[role="dialog"]');

		// Verify the header is visible
		await expect(header).toBeVisible();

		// Scroll the modal to the bottom
		await modal.evaluate((el) => el.scrollTo(0, el.scrollHeight));
		await page.waitForTimeout(100);

		// The header should remain visible (sticky) after scrolling
		await expect(header).toBeVisible();
		await expect(header).toBeInViewport();

		// The close button inside the header should also be reachable
		const closeButton = page.locator('.close-button');
		await expect(closeButton).toBeVisible();
		await expect(closeButton).toBeInViewport();
	});

	test('modal respects max-height and enables scrolling', async ({ page }) => {
		await navigateToCustomers(page);
		await page.click('[data-testid="add-customer-btn"]');
		await page.waitForSelector('.modal[role="dialog"]');

		const modal = page.locator('.modal[role="dialog"]');
		const overflowY = await modal.evaluate((el) => getComputedStyle(el).overflowY);
		expect(overflowY).toBe('auto');
	});
});
