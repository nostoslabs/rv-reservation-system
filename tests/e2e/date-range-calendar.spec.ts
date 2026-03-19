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

function getTodayIso(): string {
	return offsetDate(0);
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

function dayButton(page: Page, dayNum: number) {
	return modal(page).locator('.calendar .day').filter({ hasText: new RegExp(`^${dayNum}$`) });
}

test.describe('DateRangeCalendar', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('clicking a day sets it as arrival with range-start class', async ({ page }) => {
		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const today = new Date();
		const day15 = 15;
		const btn = dayButton(page, day15);
		await btn.click();
		
		// Should have range-start class
		await expect(btn).toHaveClass(/range-start/);
	});

	test('clicking two days highlights the range between them', async ({ page }) => {
		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		// Navigate to a month where we can pick days 10 and 15
		const startDay = 10;
		const endDay = 15;

		await dayButton(page, startDay).click();
		await dayButton(page, endDay).click();

		// Start should have range-start
		await expect(dayButton(page, startDay)).toHaveClass(/range-start/);
		// End should have range-end
		await expect(dayButton(page, endDay)).toHaveClass(/range-end/);
		// Days in between should have in-range
		for (let d = startDay + 1; d < endDay; d++) {
			await expect(dayButton(page, d)).toHaveClass(/in-range/);
		}
		// Days outside should NOT have range classes
		await expect(dayButton(page, startDay - 1)).not.toHaveClass(/range-start|range-end|in-range/);
		await expect(dayButton(page, endDay + 1)).not.toHaveClass(/range-start|range-end|in-range/);
	});

	test('selected dates sync to native date inputs', async ({ page }) => {
		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const startDay = 10;
		const endDay = 14;

		await dayButton(page, startDay).click();
		await dayButton(page, endDay).click();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);

		const startVal = await startInput.inputValue();
		const endVal = await endInput.inputValue();

		// Should end with -10 and -14
		expect(startVal).toMatch(/-10$/);
		expect(endVal).toMatch(/-14$/);
	});

	test('native date input changes sync to calendar highlights', async ({ page }) => {
		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);

		// Get current month/year for constructing dates
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');

		await startInput.fill(`${y}-${m}-08`);
		await endInput.fill(`${y}-${m}-12`);

		// Calendar should show the range
		await expect(dayButton(page, 8)).toHaveClass(/range-start/);
		await expect(dayButton(page, 12)).toHaveClass(/range-end/);
		await expect(dayButton(page, 10)).toHaveClass(/in-range/);
	});
});
