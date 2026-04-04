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

test.describe('No-show reservation status', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('no-show status appears in reservation modal dropdown', async ({ page }) => {
		await page.click('[data-testid="new-reservation-btn"]');
		await expect(modal(page)).toBeVisible();

		const statusSelect = modal(page).locator('select[aria-label="Reservation status"]');
		const options = statusSelect.locator('option');

		// Should have 8 statuses including no-show
		await expect(options).toHaveCount(8);

		// Verify no-show is one of the options
		const optionTexts = await options.allTextContents();
		expect(optionTexts).toContain('No-Show');
	});

	test('no-show status appears in legend', async ({ page }) => {
		const legend = page.locator('.status-legend');
		await expect(legend).toContainText('No-Show');
	});

	test('reservation can be created with no-show status', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		await clickCellAtDate(page, today, 0);
		await expect(modal(page)).toBeVisible();

		await modal(page).locator('[data-testid="guest-name-input"]').fill('No Show Guest');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('select[aria-label="Reservation status"]').selectOption('no-show');

		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Verify the cell is occupied
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied.locator('.reservation-label')).toContainText('No Show Guest');
	});

	test('no-show reservation has distinct styling on grid', async ({ page }) => {
		const today = offsetDate(0);
		const endDate = offsetDate(3);

		await clickCellAtDate(page, today, 0);
		await expect(modal(page)).toBeVisible();

		await modal(page).locator('[data-testid="guest-name-input"]').fill('Ghost Guest');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('select[aria-label="Reservation status"]').selectOption('no-show');

		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Verify the occupied cell has a background-color style (from status styling)
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		const bgColor = await occupied.evaluate((el) => el.style.backgroundColor);
		expect(bgColor).not.toBe('');

		// Verify it has a background-image (the stripe pattern)
		const bgImage = await occupied.evaluate((el) => el.style.backgroundImage);
		expect(bgImage).not.toBe('none');
		expect(bgImage).not.toBe('');
	});
});
