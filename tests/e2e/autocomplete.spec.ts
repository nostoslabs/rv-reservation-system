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

test.describe('Auto-complete and auto-create', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('auto-creates customer on reservation save', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'John Smith', phone: '555-1234', startDate: today, endDate });

		// Navigate to customers and check John was auto-created
		await page.click('[data-testid="customers-link"]');
		await page.waitForURL(/\/customers$/);

		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(page.locator('.customer-name')).toContainText('John Smith');
	});

	test('does not create duplicate customer on second reservation for same guest', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);
		const startDate2 = offsetDate(5);
		const endDate2 = offsetDate(8);

		// First reservation
		await createReservation(page, { name: 'John Smith', phone: '555-1234', startDate: today, endDate });

		// Second reservation at a different site
		await createReservation(page, { name: 'John Smith', phone: '555-1234', startDate: startDate2, endDate: endDate2, rowIndex: 1 });

		// Navigate to customers
		await page.click('[data-testid="customers-link"]');
		await page.waitForURL(/\/customers$/);

		// Should only have 1 customer
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
	});

	test('autocomplete shows suggestions when typing existing customer name', async ({ page }) => {
		// First, create a customer by making a reservation
		const today = offsetDate(0);
		const endDate = offsetDate(3);
		await createReservation(page, { name: 'Alice Johnson', phone: '555-9999', startDate: today, endDate });

		// Open a new reservation modal
		const startDate2 = offsetDate(5);
		await clickCellAtDate(page, startDate2, 1);
		await expect(modal(page)).toBeVisible();

		// Type the beginning of Alice's name
		const nameInput = modal(page).locator('[data-testid="guest-name-input"]');
		await nameInput.fill('Alice');

		// Should see a suggestion dropdown
		const dropdown = modal(page).locator('.autocomplete-dropdown');
		await expect(dropdown).toBeVisible();
		await expect(dropdown.locator('.option-label')).toContainText(['Alice Johnson']);
	});

	test('selecting autocomplete suggestion fills phone number', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);
		await createReservation(page, { name: 'Bob Williams', phone: '555-7777', startDate: today, endDate });

		// Open new reservation modal
		const startDate2 = offsetDate(5);
		await clickCellAtDate(page, startDate2, 1);
		await expect(modal(page)).toBeVisible();

		// Type Bob's name
		const nameInput = modal(page).locator('[data-testid="guest-name-input"]');
		await nameInput.fill('Bob');

		// Click on the suggestion
		const dropdown = modal(page).locator('.autocomplete-dropdown');
		await expect(dropdown).toBeVisible();
		await dropdown.locator('.autocomplete-option').first().click();

		// Phone should be auto-filled
		const phoneInput = modal(page).locator('input[type="tel"]');
		await expect(phoneInput).toHaveValue('555-7777');
	});
});
