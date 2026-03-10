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

test.describe('Customer directory', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('customers link is visible on main schedule toolbar', async ({ page }) => {
		const link = page.locator('[data-testid="customers-link"]');
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', '/customers');
	});

	test('navigate to /customers from toolbar', async ({ page }) => {
		await navigateToCustomers(page);
		await expect(page.locator('h1')).toHaveText('Customers');
	});

	test('shows empty state when no customers', async ({ page }) => {
		await navigateToCustomers(page);
		const emptyState = page.locator('[data-testid="customer-empty-state"]');
		await expect(emptyState).toBeVisible();
		await expect(emptyState).toContainText('No customers yet');
	});

	test('add a customer manually', async ({ page }) => {
		await navigateToCustomers(page);
		await page.click('[data-testid="add-customer-btn"]');

		await page.fill('[data-testid="customer-name-input"]', 'John Smith');
		await page.fill('[data-testid="customer-phone-input"]', '555-1234');
		await page.fill('[data-testid="customer-email-input"]', 'john@test.com');
		await page.click('[data-testid="customer-save-btn"]');

		// Should see the customer in the table
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(page.locator('.customer-name')).toContainText('John Smith');
	});

	test('edit a customer', async ({ page }) => {
		await navigateToCustomers(page);

		// Add a customer first
		await page.click('[data-testid="add-customer-btn"]');
		await page.fill('[data-testid="customer-name-input"]', 'Jane Doe');
		await page.fill('[data-testid="customer-phone-input"]', '555-9999');
		await page.click('[data-testid="customer-save-btn"]');

		// Click on the customer row to edit
		await page.click('[data-testid="customer-row"]');
		await expect(page.locator('#customer-modal-title')).toHaveText('Edit Customer');

		// Change the name
		await page.fill('[data-testid="customer-name-input"]', 'Jane Smith');
		await page.click('[data-testid="customer-save-btn"]');

		// Should see updated name
		await expect(page.locator('.customer-name')).toContainText('Jane Smith');
	});

	test('delete a customer', async ({ page }) => {
		await navigateToCustomers(page);

		// Add a customer
		await page.click('[data-testid="add-customer-btn"]');
		await page.fill('[data-testid="customer-name-input"]', 'Delete Me');
		await page.click('[data-testid="customer-save-btn"]');

		// Open edit modal
		await page.click('[data-testid="customer-row"]');

		// Click delete (two-click)
		await page.click('[data-testid="customer-delete-btn"]');
		await page.click('[data-testid="customer-delete-btn"]');

		// Customer should be gone, empty state should appear
		await expect(page.locator('[data-testid="customer-empty-state"]')).toBeVisible();
	});

	test('search for a customer', async ({ page }) => {
		await navigateToCustomers(page);

		// Add two customers
		await page.click('[data-testid="add-customer-btn"]');
		await page.fill('[data-testid="customer-name-input"]', 'Alice Johnson');
		await page.click('[data-testid="customer-save-btn"]');

		await page.click('[data-testid="add-customer-btn"]');
		await page.fill('[data-testid="customer-name-input"]', 'Bob Williams');
		await page.click('[data-testid="customer-save-btn"]');

		// Search for "alice"
		await page.fill('[data-testid="customer-search-input"]', 'alice');

		// Should show only Alice
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(page.locator('.customer-name')).toContainText('Alice Johnson');
	});

	test('back link returns to schedule', async ({ page }) => {
		await navigateToCustomers(page);
		await page.click('[data-testid="back-to-schedule"]');
		await expect(page).toHaveURL(/\/$/);
	});
});
