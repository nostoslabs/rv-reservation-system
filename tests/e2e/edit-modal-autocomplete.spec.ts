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

test.describe('Edit modal autocomplete dropdown', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('dropdown does NOT appear when opening edit modal', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		// Create a reservation and a customer
		await createReservation(page, { name: 'Alice Johnson', phone: '555-1234', startDate: today, endDate });

		// Click the occupied cell to open edit modal
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();
		await expect(modal(page)).toBeVisible();

		// Wait for the modal to settle (focus fires on open)
		await page.waitForTimeout(300);

		// The autocomplete dropdown should NOT be visible
		const dropdown = modal(page).locator('.autocomplete-dropdown');
		await expect(dropdown).toBeHidden();
	});

	test('dropdown appears when user types in name field on edit modal', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		// Create a reservation and customer
		await createReservation(page, { name: 'Alice Johnson', phone: '555-1234', startDate: today, endDate });

		// Open edit modal
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();
		await expect(modal(page)).toBeVisible();
		await page.waitForTimeout(300);

		// Now type in the name field — dropdown should appear
		const nameInput = modal(page).locator('[data-testid="guest-name-input"]');
		await nameInput.clear();
		await nameInput.type('Alice');

		const dropdown = modal(page).locator('.autocomplete-dropdown');
		await expect(dropdown).toBeVisible();
	});
});
