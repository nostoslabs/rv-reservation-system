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
	opts: { name: string; startDate: string; endDate: string; rowIndex?: number }
) {
	await clickCellAtDate(page, opts.startDate, opts.rowIndex ?? 0);
	await expect(modal(page)).toBeVisible();

	await modal(page).locator('input[placeholder="Guest name"]').fill(opts.name);
	await modal(page).locator('input[type="date"]').first().fill(opts.startDate);
	await modal(page).locator('input[type="date"]').nth(1).fill(opts.endDate);

	await modal(page).locator('button[type="submit"]').click();
	await expect(modal(page)).not.toBeVisible();
}

test.describe('Customer page does not destroy reservation data', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('reservations persist after visiting customer page', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);
		await createReservation(page, { name: 'Persist Guest', startDate: today, endDate });

		// Verify reservation exists
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied).toBeVisible();

		// Navigate to customers
		await page.locator('[data-testid="customers-link"]').click();
		await page.waitForSelector('h1:has-text("Customers")');
		await page.waitForTimeout(500);

		// Go back to main page
		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');
		await page.waitForTimeout(300);

		// Reservation should still exist
		const occupiedAfter = page.locator('.grid-cell.occupied').first();
		await occupiedAfter.scrollIntoViewIfNeeded();
		await expect(occupiedAfter).toBeVisible();
	});

	test('reservations persist after adding a customer', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);
		await createReservation(page, { name: 'Stay Guest', startDate: today, endDate });

		// Navigate to customers
		await page.locator('[data-testid="customers-link"]').click();
		await page.waitForSelector('h1:has-text("Customers")');

		// Add a new customer
		await page.locator('[data-testid="add-customer-btn"]').click();
		await page.waitForSelector('.modal[role="dialog"]');
		await page.locator('[data-testid="customer-name-input"]').fill('Manual Customer');
		await page.locator('.modal[role="dialog"] button[type="submit"]').click();
		await expect(page.locator('.modal[role="dialog"]')).not.toBeVisible();
		await page.waitForTimeout(300);

		// Go back to main page
		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');
		await page.waitForTimeout(300);

		// Reservation should still exist
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied).toBeVisible();
	});

	test('reservations persist after editing a customer', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);
		await createReservation(page, { name: 'Edit Test Guest', startDate: today, endDate });

		// Navigate to customers
		await page.locator('[data-testid="customers-link"]').click();
		await page.waitForSelector('h1:has-text("Customers")');

		// Click on auto-created customer to edit
		await page.locator('[data-testid="customer-row"]').first().click();
		await page.waitForSelector('.modal[role="dialog"]');

		// Change phone number
		await page.locator('[data-testid="customer-phone-input"]').fill('555-1234');
		await page.locator('.modal[role="dialog"] button[type="submit"]').click();
		await expect(page.locator('.modal[role="dialog"]')).not.toBeVisible();
		await page.waitForTimeout(300);

		// Go back to main page
		await page.locator('[data-testid="back-to-schedule"]').click();
		await page.waitForSelector('.toolbar-title');
		await page.waitForTimeout(300);

		// Reservation should still exist
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied).toBeVisible();
	});
});
