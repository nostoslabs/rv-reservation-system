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
	opts: { name: string; rvType?: string; startDate: string; endDate: string; rowIndex?: number }
) {
	await clickCellAtDate(page, opts.startDate, opts.rowIndex ?? 0);
	await expect(modal(page)).toBeVisible();

	await modal(page).locator('[data-testid="guest-name-input"]').fill(opts.name);
	await modal(page).locator('input[type="date"]').first().fill(opts.startDate);
	await modal(page).locator('input[type="date"]').nth(1).fill(opts.endDate);
	if (opts.rvType) {
		await modal(page).locator('[data-testid="rv-type-input"]').fill(opts.rvType);
	}

	await modal(page).locator('button[type="submit"]').click();
	await expect(modal(page)).not.toBeVisible();
}

test.describe('RV type in search', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('searching by RV type returns matching reservations', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'John Smith', rvType: 'Fifth Wheel', startDate: today, endDate, rowIndex: 0 });
		await createReservation(page, { name: 'Jane Doe', rvType: 'Class A', startDate: today, endDate, rowIndex: 1 });

		// Type "Fifth" in the search box
		const searchInput = page.locator('input[aria-label="Search reservations"]');
		await searchInput.fill('Fifth');

		// Should see John Smith in the results
		const dropdown = page.locator('.search-dropdown');
		await expect(dropdown).toBeVisible();
		await expect(dropdown.locator('.search-result-name')).toContainText(['John Smith']);
	});

	test('RV type displays in search dropdown results', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'Alice Johnson', rvType: 'Travel Trailer', startDate: today, endDate });

		const searchInput = page.locator('input[aria-label="Search reservations"]');
		await searchInput.fill('Alice');

		const dropdown = page.locator('.search-dropdown');
		await expect(dropdown).toBeVisible();

		// RV type should appear in the result metadata
		await expect(dropdown.locator('.search-result-rvtype')).toContainText(['Travel Trailer']);
	});

	test('search still works for name and location', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'Bob Williams', rvType: 'Class C', startDate: today, endDate });

		// Search by name
		const searchInput = page.locator('input[aria-label="Search reservations"]');
		await searchInput.fill('Bob');
		await expect(page.locator('.search-dropdown .search-result-name')).toContainText(['Bob Williams']);
	});
});
