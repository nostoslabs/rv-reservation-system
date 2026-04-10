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
	return cell;
}

async function createReservation(
	page: Page,
	opts: { name: string; startDate: string; endDate: string; rowIndex?: number; status?: string }
) {
	const cell = await clickCellAtDate(page, opts.startDate, opts.rowIndex ?? 0);
	await cell.click();
	await expect(modal(page)).toBeVisible();

	await modal(page).locator('[data-testid="guest-name-input"]').fill(opts.name);
	await modal(page).locator('input[type="date"]').first().fill(opts.startDate);
	await modal(page).locator('input[type="date"]').nth(1).fill(opts.endDate);

	if (opts.status) {
		await modal(page).locator('select[aria-label="Reservation status"]').selectOption(opts.status);
	}

	await modal(page).locator('button[type="submit"]').click();
	await expect(modal(page)).not.toBeVisible();
}

test.describe('Today column indicator', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('today header has prominent indicator styling', async ({ page }) => {
		const todayHeader = page.locator('th.date-header.today');
		await todayHeader.scrollIntoViewIfNeeded();

		// Header should have distinct background color (not default)
		const headerBg = await todayHeader.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(headerBg).not.toBe('rgb(255, 255, 255)');

		// Header should have box-shadow (top + bottom bars)
		const headerShadow = await todayHeader.evaluate((el) => getComputedStyle(el).boxShadow);
		expect(headerShadow).not.toBe('none');
	});

	test('today cells have ::after pseudo-element indicator even when occupied', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(2);

		// Fill today's column with reservations across multiple sites
		await createReservation(page, { name: 'Guest A', startDate: today, endDate, rowIndex: 0, status: 'reserved' });
		await createReservation(page, { name: 'Guest B', startDate: today, endDate, rowIndex: 1, status: 'checked-in' });
		await createReservation(page, { name: 'Guest C', startDate: today, endDate, rowIndex: 2, status: 'alert' });

		// Get an occupied today cell
		const occupiedTodayCell = page.locator('.grid-cell.today.occupied').first();
		await occupiedTodayCell.scrollIntoViewIfNeeded();

		// The ::after pseudo-element adds box-shadow indicators that survive inline status styles.
		// Verify the ::after pseudo-element has box-shadow
		const afterShadow = await occupiedTodayCell.evaluate((el) => getComputedStyle(el, '::after').boxShadow);
		expect(afterShadow).not.toBe('none');
	});

	test('today column is visually distinct when all rows are occupied', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(2);

		await createReservation(page, { name: 'Guest A', startDate: today, endDate, rowIndex: 0 });
		await createReservation(page, { name: 'Guest B', startDate: today, endDate, rowIndex: 1 });
		await createReservation(page, { name: 'Guest C', startDate: today, endDate, rowIndex: 2 });

		await page.click('[data-testid="today-button"]');
		await page.waitForTimeout(300);

		// Verify the today header is still visually distinct
		const todayHeader = page.locator('th.date-header.today');
		await expect(todayHeader).toBeVisible();
		const headerBg = await todayHeader.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(headerBg).not.toBe('rgb(255, 255, 255)');
	});
});
