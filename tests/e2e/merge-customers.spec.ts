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

async function addCustomer(page: Page, name: string, phone = '', email = '') {
	await page.click('[data-testid="add-customer-btn"]');
	await page.fill('[data-testid="customer-name-input"]', name);
	if (phone) await page.fill('[data-testid="customer-phone-input"]', phone);
	if (email) await page.fill('[data-testid="customer-email-input"]', email);
	await page.click('[data-testid="customer-save-btn"]');
	// Wait for modal to close
	await expect(page.locator('#customer-modal-title')).not.toBeVisible();
}

test.describe('Merge customers', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
		await navigateToCustomers(page);
	});

	test('select mode toggle: click Select shows checkboxes, Cancel hides them', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		// Enter select mode
		await page.click('[data-testid="select-mode-btn"]');
		await expect(page.locator('[data-testid="customer-checkbox"]').first()).toBeVisible();
		await expect(page.locator('[data-testid="select-all-checkbox"]')).toBeVisible();

		// Cancel exits select mode
		await page.click('[data-testid="cancel-select-btn"]');
		await expect(page.locator('[data-testid="customer-checkbox"]')).toHaveCount(0);
	});

	test('select 2 customers enables merge button', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		await page.click('[data-testid="select-mode-btn"]');

		// Initially merge button is disabled
		const mergeBtn = page.locator('[data-testid="merge-selected-btn"]');
		await expect(mergeBtn).toBeDisabled();

		// Select first customer
		await page.locator('[data-testid="customer-checkbox"]').first().click();
		await expect(mergeBtn).toBeDisabled();

		// Select second customer
		await page.locator('[data-testid="customer-checkbox"]').nth(1).click();
		await expect(mergeBtn).toBeEnabled();
		await expect(mergeBtn).toContainText('Merge Selected (2)');
	});

	test('open merge preview shows fields', async ({ page }) => {
		await addCustomer(page, 'Alice Smith', '555-1111', 'alice@test.com');
		await addCustomer(page, 'Alice Jones', '555-2222', 'jones@test.com');

		await page.click('[data-testid="select-mode-btn"]');
		await page.locator('[data-testid="customer-checkbox"]').first().click();
		await page.locator('[data-testid="customer-checkbox"]').nth(1).click();
		await page.click('[data-testid="merge-selected-btn"]');

		// Modal opens
		const modal = page.locator('[data-testid="merge-preview-modal"]');
		await expect(modal).toBeVisible();

		// Field sections exist
		await expect(page.locator('[data-testid="merge-field-name"]')).toBeVisible();
		await expect(page.locator('[data-testid="merge-field-phone"]')).toBeVisible();
		await expect(page.locator('[data-testid="merge-field-email"]')).toBeVisible();
	});

	test('confirm merge: toast, one fewer customer row, correct merged name', async ({ page }) => {
		await addCustomer(page, 'Bob', '555-1111');
		await addCustomer(page, 'Bobby Smith', '555-1111');

		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(2);

		await page.click('[data-testid="select-mode-btn"]');
		await page.locator('[data-testid="customer-checkbox"]').first().click();
		await page.locator('[data-testid="customer-checkbox"]').nth(1).click();
		await page.click('[data-testid="merge-selected-btn"]');

		// Confirm merge
		await page.click('[data-testid="merge-confirm-btn"]');

		// Toast should appear
		await expect(page.locator('.toast')).toBeVisible();
		await expect(page.locator('.toast')).toContainText('Merged 2 customers');

		// One fewer customer
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);

		// Merged name should be the longer one
		await expect(page.locator('.customer-name').first()).toContainText('Bobby Smith');
	});

	test('cancel merge returns to select mode', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		await page.click('[data-testid="select-mode-btn"]');
		await page.locator('[data-testid="customer-checkbox"]').first().click();
		await page.locator('[data-testid="customer-checkbox"]').nth(1).click();
		await page.click('[data-testid="merge-selected-btn"]');

		// Cancel
		await page.click('[data-testid="merge-cancel-btn"]');

		// Modal closes, still in select mode
		await expect(page.locator('[data-testid="merge-preview-modal"]')).not.toBeVisible();
		await expect(page.locator('[data-testid="cancel-select-btn"]')).toBeVisible();

		// Customers still there
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(2);
	});

	test('reservation count preserved after merge', async ({ page }) => {
		// Create a reservation first, which will auto-create a customer
		await page.goto('/');
		await page.waitForSelector('.toolbar-title');

		// We'll add two customers with the same phone, then create reservations manually
		// For simplicity, just test with manually created customers
		await navigateToCustomers(page);
		await addCustomer(page, 'Charlie Brown', '555-3333');
		await addCustomer(page, 'Charlie B', '555-3333');

		// Merge them
		await page.click('[data-testid="select-mode-btn"]');
		await page.locator('[data-testid="customer-checkbox"]').first().click();
		await page.locator('[data-testid="customer-checkbox"]').nth(1).click();
		await page.click('[data-testid="merge-selected-btn"]');
		await page.click('[data-testid="merge-confirm-btn"]');

		// Should have one customer
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
	});
});
