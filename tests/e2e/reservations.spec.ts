import { test, expect, type Page } from '@playwright/test';

async function resetApp(page: Page) {
	await page.goto('/');
	await page.evaluate(() => window.localStorage.clear());
	await page.reload();
	await page.waitForSelector('#working-sheet-title');
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

/** Double-click a grid cell by locating the date column via data-date attribute. */
async function dblclickCellAtDate(page: Page, dateIso: string, rowIndex = 0) {
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
	await cell.dblclick();
}

/** Create a reservation via UI and verify modal closes. */
async function createReservation(
	page: Page,
	opts: { name: string; startDate: string; endDate: string; rowIndex?: number }
) {
	await dblclickCellAtDate(page, opts.startDate, opts.rowIndex ?? 0);
	await expect(modal(page)).toBeVisible();

	await modal(page).locator('input[placeholder="Guest name"]').fill(opts.name);
	await modal(page).locator('input[type="date"]').first().fill(opts.startDate);
	await modal(page).locator('input[type="date"]').nth(1).fill(opts.endDate);

	await modal(page).locator('button[type="submit"]').click();
	await expect(modal(page)).not.toBeVisible();
}

test.describe('Reservation CRUD', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('create a reservation via double-click', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'John Doe', startDate: today, endDate });

		// Scroll the first occupied cell into view and verify it shows
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied.locator('.reservation-label')).toHaveText('John Doe');
	});

	test('edit an existing reservation', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'Jane Smith', startDate: today, endDate });

		// Find occupied cell, scroll to it, double-click to edit
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.dblclick();
		await expect(modal(page)).toBeVisible();

		await expect(modal(page).locator('#reservation-modal-title')).toHaveText('Edit Reservation');
		await modal(page).locator('input[placeholder="Guest name"]').fill('Jane Updated');
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		const updated = page.locator('.grid-cell.occupied').first();
		await updated.scrollIntoViewIfNeeded();
		await expect(updated.locator('.reservation-label')).toHaveText('Jane Updated');
	});

	test('delete a reservation', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(2);

		await createReservation(page, { name: 'To Delete', startDate: today, endDate });

		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.dblclick();
		await expect(modal(page)).toBeVisible();

		await modal(page).locator('button.danger').click();
		await expect(modal(page)).not.toBeVisible();

		// No occupied cells should remain
		await expect(page.locator('.grid-cell.occupied')).toHaveCount(0);
	});

	test('overlap rejection', async ({ page }) => {
		const startDate = offsetDate(1);
		const endDate = offsetDate(4);

		await createReservation(page, { name: 'First Guest', startDate, endDate });

		// Double-click an EMPTY cell in the same row (today, before the reservation)
		await dblclickCellAtDate(page, getTodayIso(), 0);
		await expect(modal(page)).toBeVisible();

		await modal(page).locator('input[placeholder="Guest name"]').fill('Overlapper');
		await modal(page).locator('input[type="date"]').first().fill(startDate);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);

		// Make sure first parking location is selected
		const select = modal(page).locator('select').first();
		const firstOpt = await select.locator('option').first().getAttribute('value');
		if (firstOpt) await select.selectOption(firstOpt);

		await modal(page).locator('button[type="submit"]').click();

		// Modal stays open with error
		await expect(modal(page).locator('.error-box')).toBeVisible();
		await expect(modal(page).locator('.error-box')).toContainText('Overlap');
	});
});

test.describe('TODAY alignment', () => {
	test('today column is visible on initial load', async ({ page }) => {
		await resetApp(page);

		const today = getTodayIso();
		const todayHeader = page.locator(`th.date-header[data-date="${today}"]`);
		await expect(todayHeader).toBeAttached();

		// Wait for any scroll retries to settle
		await page.waitForTimeout(600);

		// Verify the today header is fully within the visible scroll area
		// (right of the 220px sticky first column and left of the scroller's right edge)
		const isInView = await page.evaluate((dateIso) => {
			const scroller = document.querySelector('.sheet-scroll');
			const header = document.querySelector(`th.date-header[data-date="${dateIso}"]`);
			if (!scroller || !header) return false;
			const scrollerRect = scroller.getBoundingClientRect();
			const headerRect = header.getBoundingClientRect();
			const stickyColumnWidth = 220;
			return (
				headerRect.left >= scrollerRect.left + stickyColumnWidth &&
				headerRect.right <= scrollerRect.right
			);
		}, today);
		expect(isInView).toBe(true);
	});

	test('Today button scrolls grid to today', async ({ page }) => {
		await resetApp(page);

		// Scroll grid far to the right so today is off-screen
		await page.evaluate(() => {
			const scroller = document.querySelector('.sheet-scroll');
			if (scroller) scroller.scrollLeft = scroller.scrollWidth;
		});
		await page.waitForTimeout(100);

		// Click the Today button using data-testid for robustness
		await page.locator('[data-testid="today-button"]').click();
		await page.waitForTimeout(500);

		const today = getTodayIso();

		// Verify the today header is fully within the visible scroll area
		const isInView = await page.evaluate((dateIso) => {
			const scroller = document.querySelector('.sheet-scroll');
			const header = document.querySelector(`th.date-header[data-date="${dateIso}"]`);
			if (!scroller || !header) return false;
			const scrollerRect = scroller.getBoundingClientRect();
			const headerRect = header.getBoundingClientRect();
			const stickyColumnWidth = 220;
			return (
				headerRect.left >= scrollerRect.left + stickyColumnWidth &&
				headerRect.right <= scrollerRect.right
			);
		}, today);
		expect(isInView).toBe(true);
	});

	test('today column has visual highlight', async ({ page }) => {
		await resetApp(page);

		const today = getTodayIso();

		// Verify header has today class with highlight styling
		const todayHeader = page.locator(`th.date-header.today[data-date="${today}"]`);
		await expect(todayHeader).toBeAttached();

		// Verify the today header has a distinguishable background colour
		const headerBg = await todayHeader.evaluate((el) => getComputedStyle(el).backgroundColor);
		// The today header uses rgba(10,99,224,0.12) which computes to a non-white value
		expect(headerBg).not.toBe('rgb(255, 255, 255)');

		// Verify today body cells also have the today class
		const todayCells = page.locator('td.grid-cell.today');
		const cellCount = await todayCells.count();
		// There should be at least as many today cells as parking locations (if any exist)
		const locationCount = await page.locator('th.location-cell').count();
		expect(cellCount).toBe(locationCount);
	});
});
