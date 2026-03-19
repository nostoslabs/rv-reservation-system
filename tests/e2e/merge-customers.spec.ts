import { test, expect, type Page } from '@playwright/test';

async function resetApp(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
	await page.reload();
	await page.waitForSelector('.toolbar-title');
	await page.waitForTimeout(300);
}

function offsetDate(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${dd}`;
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
	await expect(page.locator('#customer-modal-title')).not.toBeVisible();
}

const modal = (page: Page) => page.locator('.modal[role="dialog"]');

async function clickCellAtDate(page: Page, dateIso: string, rowIndex = 0) {
	const colIndex = await page.evaluate((date) => {
		const headers = document.querySelectorAll('th.date-header[data-date]');
		for (let i = 0; i < headers.length; i++) {
			if (headers[i].getAttribute('data-date') === date) return i;
		}
		return -1;
	}, dateIso);
	if (colIndex === -1) throw new Error(`Date column ${dateIso} not found in grid`);

	const cell = page.locator('tbody tr').nth(rowIndex).locator('td.grid-cell').nth(colIndex);
	await cell.scrollIntoViewIfNeeded();
	await cell.click();
}

async function createReservation(
	page: Page,
	opts: { name: string; phone?: string; startDate: string; endDate: string; rowIndex?: number }
) {
	await clickCellAtDate(page, opts.startDate, opts.rowIndex ?? 0);
	await expect(modal(page)).toBeVisible();

	await modal(page).locator('[data-testid="guest-name-input"]').fill(opts.name);
	await modal(page).locator('input[type="date"]').first().fill(opts.startDate);
	await modal(page).locator('input[type="date"]').nth(1).fill(opts.endDate);
	if (opts.phone) {
		await modal(page).locator('input[type="tel"]').fill(opts.phone);
	}

	await modal(page).locator('button[type="submit"]').click();
	await expect(modal(page)).not.toBeVisible();
}

async function enterSelectAndPickAll(page: Page) {
	await page.click('[data-testid="select-mode-btn"]');
	await page.click('[data-testid="select-all-checkbox"]');
}

test.describe('Merge customers — select mode', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
		await navigateToCustomers(page);
	});

	test('Select button shows checkboxes, Cancel hides them', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		await page.click('[data-testid="select-mode-btn"]');
		await expect(page.locator('[data-testid="customer-checkbox"]')).toHaveCount(2);
		await expect(page.locator('[data-testid="select-all-checkbox"]')).toBeVisible();
		// Search + sort + add hidden in select mode
		await expect(page.locator('[data-testid="customer-search-input"]')).not.toBeVisible();
		await expect(page.locator('[data-testid="add-customer-btn"]')).not.toBeVisible();

		await page.click('[data-testid="cancel-select-btn"]');
		await expect(page.locator('[data-testid="customer-checkbox"]')).toHaveCount(0);
		// Normal toolbar restored
		await expect(page.locator('[data-testid="customer-search-input"]')).toBeVisible();
		await expect(page.locator('[data-testid="add-customer-btn"]')).toBeVisible();
	});

	test('row click toggles checkbox in select mode, opens edit in normal mode', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');

		// Normal mode: row click opens edit modal
		await page.click('[data-testid="customer-row"]');
		await expect(page.locator('#customer-modal-title')).toHaveText('Edit Customer');
		await page.keyboard.press('Escape');

		// Select mode: row click toggles checkbox
		await page.click('[data-testid="select-mode-btn"]');
		await page.click('[data-testid="customer-row"]');
		await expect(page.locator('[data-testid="customer-checkbox"]').first()).toBeChecked();

		// Click again to deselect
		await page.click('[data-testid="customer-row"]');
		await expect(page.locator('[data-testid="customer-checkbox"]').first()).not.toBeChecked();
	});

	test('select-all checkbox selects and deselects all', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');
		await addCustomer(page, 'Charlie', '555-3333');

		await page.click('[data-testid="select-mode-btn"]');

		// Select all
		await page.click('[data-testid="select-all-checkbox"]');
		const checkboxes = page.locator('[data-testid="customer-checkbox"]');
		await expect(checkboxes.nth(0)).toBeChecked();
		await expect(checkboxes.nth(1)).toBeChecked();
		await expect(checkboxes.nth(2)).toBeChecked();
		await expect(page.locator('[data-testid="merge-selected-btn"]')).toContainText('Merge Selected (3)');

		// Deselect all
		await page.click('[data-testid="select-all-checkbox"]');
		await expect(checkboxes.nth(0)).not.toBeChecked();
		await expect(checkboxes.nth(1)).not.toBeChecked();
		await expect(checkboxes.nth(2)).not.toBeChecked();
		await expect(page.locator('[data-testid="merge-selected-btn"]')).toContainText('Merge Selected (0)');
	});

	test('merge button disabled until 2+ selected', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		await page.click('[data-testid="select-mode-btn"]');
		const mergeBtn = page.locator('[data-testid="merge-selected-btn"]');

		// 0 selected → disabled
		await expect(mergeBtn).toBeDisabled();

		// 1 selected → still disabled
		await page.locator('[data-testid="customer-checkbox"]').first().click();
		await expect(mergeBtn).toBeDisabled();
		await expect(mergeBtn).toContainText('Merge Selected (1)');

		// 2 selected → enabled
		await page.locator('[data-testid="customer-checkbox"]').nth(1).click();
		await expect(mergeBtn).toBeEnabled();
		await expect(mergeBtn).toContainText('Merge Selected (2)');

		// Deselect one → disabled again
		await page.locator('[data-testid="customer-checkbox"]').first().click();
		await expect(mergeBtn).toBeDisabled();
		await expect(mergeBtn).toContainText('Merge Selected (1)');
	});
});

test.describe('Merge customers — preview modal', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
		await navigateToCustomers(page);
	});

	test('shows all field sections with radio options for differing values', async ({ page }) => {
		await addCustomer(page, 'Alice Smith', '555-1111', 'alice@test.com');
		await addCustomer(page, 'Alice Jones', '555-2222', 'jones@test.com');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');

		const mergeModal = page.locator('[data-testid="merge-preview-modal"]');
		await expect(mergeModal).toBeVisible();
		await expect(mergeModal.locator('h2')).toContainText('Merge 2 Customers');

		// Each field section exists
		await expect(page.locator('[data-testid="merge-field-name"]')).toBeVisible();
		await expect(page.locator('[data-testid="merge-field-phone"]')).toBeVisible();
		await expect(page.locator('[data-testid="merge-field-email"]')).toBeVisible();
		await expect(page.locator('[data-testid="merge-field-notes"]')).toBeVisible();

		// Name field has two radio options
		const nameRadios = page.locator('[data-testid="merge-field-name"] input[type="radio"]');
		await expect(nameRadios).toHaveCount(2);
	});

	test('switching field selection updates merged result preview', async ({ page }) => {
		await addCustomer(page, 'Bob', '555-1111', 'bob@old.com');
		await addCustomer(page, 'Bobby Smith', '555-2222', 'bobby@new.com');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');

		// Default: longest name "Bobby Smith" is selected
		const preview = page.locator('.preview-card');
		await expect(preview).toContainText('Bobby Smith');

		// Switch to "Bob"
		await page.locator('[data-testid="merge-field-name"]').getByRole('radio', { name: 'Bob', exact: true }).click();
		// Preview updates: "Name:" label followed by "Bob"
		await expect(preview).toContainText('Bob');
		await expect(preview).not.toContainText('Bobby Smith');

		// Switch email
		await page.locator('[data-testid="merge-field-email"]').getByRole('radio', { name: 'bob@old.com' }).click();
		await expect(preview).toContainText('bob@old.com');
	});

	test('single unique value shows as text without radio options', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111', 'alice@test.com');
		await addCustomer(page, 'Alice', '555-1111', 'alice@test.com');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');

		// Name is identical → no radios, just text display
		const nameField = page.locator('[data-testid="merge-field-name"]');
		await expect(nameField.locator('input[type="radio"]')).toHaveCount(0);
		await expect(nameField).toContainText('Alice');
	});

	test('cancel returns to select mode without changes', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');

		await page.click('[data-testid="merge-cancel-btn"]');

		await expect(page.locator('[data-testid="merge-preview-modal"]')).not.toBeVisible();
		await expect(page.locator('[data-testid="cancel-select-btn"]')).toBeVisible();
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(2);
	});

	test('escape key closes merge preview modal', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');
		await expect(page.locator('[data-testid="merge-preview-modal"]')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.locator('[data-testid="merge-preview-modal"]')).not.toBeVisible();
	});
});

test.describe('Merge customers — confirm merge', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
		await navigateToCustomers(page);
	});

	test('merge two customers: toast, one row, correct name', async ({ page }) => {
		await addCustomer(page, 'Bob', '555-1111');
		await addCustomer(page, 'Bobby Smith', '555-1111');
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(2);

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');
		await page.click('[data-testid="merge-confirm-btn"]');

		await expect(page.locator('.toast')).toContainText('Merged 2 customers');
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(page.locator('.customer-name').first()).toContainText('Bobby Smith');
	});

	test('merge exits select mode after confirm', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');
		await page.click('[data-testid="merge-confirm-btn"]');

		// Should be back in normal mode
		await expect(page.locator('[data-testid="select-mode-btn"]')).toBeVisible();
		await expect(page.locator('[data-testid="customer-checkbox"]')).toHaveCount(0);
	});

	test('merge with field override applies the chosen value', async ({ page }) => {
		await addCustomer(page, 'Bob', '555-1111', 'bob@old.com');
		await addCustomer(page, 'Bobby Smith', '555-2222', 'bobby@new.com');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');

		// Override: pick "Bob" instead of default "Bobby Smith"
		await page.locator('[data-testid="merge-field-name"]').getByRole('radio', { name: 'Bob', exact: true }).click();
		// Override: pick the older email
		await page.locator('[data-testid="merge-field-email"]').getByRole('radio', { name: 'bob@old.com' }).click();

		await page.click('[data-testid="merge-confirm-btn"]');

		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(page.locator('.customer-name').first()).toContainText('Bob');

		// Verify via edit modal
		await page.click('[data-testid="customer-row"]');
		await expect(page.locator('[data-testid="customer-email-input"]')).toHaveValue('bob@old.com');
	});

	test('merge three customers at once', async ({ page }) => {
		await addCustomer(page, 'Alice', '555-1111');
		await addCustomer(page, 'Bob', '555-2222');
		await addCustomer(page, 'Charlie', '555-3333');
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(3);

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');

		await expect(page.locator('[data-testid="merge-preview-modal"] h2')).toContainText('Merge 3 Customers');

		await page.click('[data-testid="merge-confirm-btn"]');

		await expect(page.locator('.toast')).toContainText('Merged 3 customers');
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
	});

	test('merged customer data visible in edit modal', async ({ page }) => {
		await addCustomer(page, 'Bob', '555-1111', 'bob@test.com');
		await addCustomer(page, 'Bobby Smith', '', 'bobby@gmail.com');

		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');
		await page.click('[data-testid="merge-confirm-btn"]');

		// Open the merged customer
		await page.click('[data-testid="customer-row"]');
		await expect(page.locator('[data-testid="customer-name-input"]')).toHaveValue('Bobby Smith');
		// Phone should have the non-empty value
		await expect(page.locator('[data-testid="customer-phone-input"]')).toHaveValue('555-1111');
	});
});

test.describe('Merge customers — reservation re-linking', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('reservation re-links to merged customer', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		// Create a reservation (auto-creates customer "Bob Smith")
		await createReservation(page, { name: 'Bob Smith', phone: '555-1234', startDate: today, endDate });

		// Go to customers, add a second customer manually
		await navigateToCustomers(page);
		await addCustomer(page, 'Bobby Smith', '555-5678');

		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(2);

		// Merge them
		await enterSelectAndPickAll(page);
		await page.click('[data-testid="merge-selected-btn"]');
		await page.click('[data-testid="merge-confirm-btn"]');

		// One customer remaining with the longer name
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(page.locator('.customer-name').first()).toContainText('Bobby Smith');

		// Go back to schedule and verify the reservation still exists
		await page.click('[data-testid="back-to-schedule"]');
		await page.waitForSelector('.toolbar-title');
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied).toBeVisible();
	});
});

test.describe('Merge customers — startup dedup migration', () => {
	test('auto-merges duplicate customers on app load', async ({ browser }) => {
		// Create a fresh browser context to ensure no cached JS state
		const context = await browser.newContext();
		const page = await context.newPage();

		// Seed localStorage with duplicates before the app loads
		await page.goto('/');
		await page.evaluate(() => {
			window.localStorage.clear();
			const key = 'rv-reservation-demo:customers:v1';
			const dupes = [
				{
					id: 'a0000000-0000-0000-0000-000000000001',
					name: 'Bobby Smith',
					phone: '555-1234',
					email: '',
					notes: '',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z'
				},
				{
					id: 'b0000000-0000-0000-0000-000000000002',
					name: 'Bobby Smith',
					phone: '555-1234',
					email: 'bobby@test.com',
					notes: 'VIP',
					createdAt: '2025-06-01T00:00:00.000Z',
					updatedAt: '2025-06-01T00:00:00.000Z'
				}
			];
			window.localStorage.setItem(key, JSON.stringify(dupes));
		});

		// Close and re-open page to get fresh JS context (simulates app restart)
		await page.close();
		const freshPage = await context.newPage();

		// This load triggers layout.ts → initAppServices() → runStartupMigrations()
		await freshPage.goto('/');
		await freshPage.waitForSelector('.toolbar-title');
		await freshPage.waitForTimeout(500);

		// Verify migration ran: check localStorage directly
		const customerCount = await freshPage.evaluate(() => {
			const raw = window.localStorage.getItem('rv-reservation-demo:customers:v1');
			return raw ? JSON.parse(raw).length : 0;
		});
		expect(customerCount).toBe(1);

		// Verify migration flag was set
		const flagSet = await freshPage.evaluate(() => {
			return window.localStorage.getItem('rv-reservation-demo:migrations:dedup-v1') !== null;
		});
		expect(flagSet).toBe(true);

		// Navigate to customers page and confirm visually
		await freshPage.click('[data-testid="customers-link"]');
		await freshPage.waitForURL(/\/customers$/);
		await expect(freshPage.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(freshPage.locator('.customer-name').first()).toContainText('Bobby Smith');

		await context.close();
	});
});
