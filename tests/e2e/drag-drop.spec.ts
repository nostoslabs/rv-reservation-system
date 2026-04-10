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

async function getColumnCenterX(page: Page, dateIso: string): Promise<number> {
	const header = page.locator(`th.date-header[data-date="${dateIso}"]`);
	await header.scrollIntoViewIfNeeded();
	const box = await header.boundingBox();
	if (!box) throw new Error(`Date header ${dateIso} not found`);
	return box.x + box.width / 2;
}

async function getRowCenterY(page: Page, rowIndex: number): Promise<number> {
	const row = page.locator('tbody tr').nth(rowIndex);
	const box = await row.boundingBox();
	if (!box) throw new Error(`Row ${rowIndex} not found`);
	return box.y + box.height / 2;
}

async function createReservation(
	page: Page,
	opts: { name: string; startDate: string; endDate: string; rowIndex?: number }
) {
	const colIndex = await page.evaluate((date) => {
		const headers = document.querySelectorAll('th.date-header[data-date]');
		for (let i = 0; i < headers.length; i++) {
			if (headers[i].getAttribute('data-date') === date) return i;
		}
		return -1;
	}, opts.startDate);
	if (colIndex === -1) throw new Error(`Date column ${opts.startDate} not found`);

	const cell = page.locator('tbody tr').nth(opts.rowIndex ?? 0).locator('td.grid-cell').nth(colIndex);
	await cell.scrollIntoViewIfNeeded();
	await cell.click();
	await expect(modal(page)).toBeVisible();

	await modal(page).locator('input[placeholder="Guest name"]').fill(opts.name);
	await modal(page).locator('input[type="date"]').first().fill(opts.startDate);
	await modal(page).locator('input[type="date"]').nth(1).fill(opts.endDate);

	await modal(page).locator('button[type="submit"]').click();
	await expect(modal(page)).not.toBeVisible();
}

test.describe('Drag and drop reservations', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('drag reservation forward by 2 days', async ({ page }) => {
		const startDate = offsetDate(1);
		const endDate = offsetDate(4);
		await createReservation(page, { name: 'Drag Forward', startDate, endDate });

		// Find the occupied cell
		const startX = await getColumnCenterX(page, startDate);
		const rowY = await getRowCenterY(page, 0);

		// Get the column width for calculating drag distance
		const header = page.locator(`th.date-header[data-date="${startDate}"]`);
		const headerBox = await header.boundingBox();
		const colWidth = headerBox!.width;

		// Drag forward 2 columns
		await page.mouse.move(startX, rowY);
		await page.mouse.down();
		// Move slowly to trigger drag detection
		await page.mouse.move(startX + colWidth, rowY, { steps: 5 });
		await page.mouse.move(startX + colWidth * 2, rowY, { steps: 5 });
		await page.mouse.up();

		await page.waitForTimeout(300);

		// Verify the reservation moved: original start cell should be empty, new start cell occupied
		const newStartDate = offsetDate(3);
		const toast = page.locator('.toast');
		await expect(toast).toContainText('Reservation moved');

		// Click the new location to verify it's the right reservation
		const newStartX = await getColumnCenterX(page, newStartDate);
		await page.mouse.click(newStartX, rowY);
		await expect(modal(page)).toBeVisible();
		await expect(modal(page).locator('input[placeholder="Guest name"]')).toHaveValue('Drag Forward');
	});

	test('drag to overlapping reservation is rejected', async ({ page }) => {
		// Place reservations back-to-back so a 1-column drag causes overlap
		const start1 = offsetDate(1);
		const end1 = offsetDate(3);
		const start2 = offsetDate(3);
		const end2 = offsetDate(5);

		await createReservation(page, { name: 'First Guest', startDate: start1, endDate: end1 });
		await createReservation(page, { name: 'Blocking Guest', startDate: start2, endDate: end2 });

		// Wait for toast to clear, then scroll to today so grid position is stable
		await page.waitForTimeout(3500);
		await page.click('[data-testid="today-button"]');
		await page.waitForTimeout(300);

		// Get the first occupied cell (First Guest at start1)
		const start1Header = page.locator(`th.date-header[data-date="${start1}"]`);
		await start1Header.scrollIntoViewIfNeeded();
		const headerBox = await start1Header.boundingBox();
		const colWidth = headerBox!.width;
		const startX = headerBox!.x + headerBox!.width / 2;
		const rowY = await getRowCenterY(page, 0);

		// Drag 1 column forward — this moves First Guest from day1-3 to day2-4,
		// which overlaps with Blocking Guest at day3-5
		await page.mouse.move(startX, rowY);
		await page.mouse.down();
		await page.mouse.move(startX + 10, rowY, { steps: 3 });
		await page.mouse.move(startX + colWidth, rowY, { steps: 5 });
		await page.mouse.up();

		await page.waitForTimeout(500);

		// Should show error toast about overlap
		const toast = page.locator('.toast');
		await expect(toast).toContainText('Overlap');
	});

	test('drag cancels on Escape key', async ({ page }) => {
		const startDate = offsetDate(1);
		const endDate = offsetDate(4);
		await createReservation(page, { name: 'Cancel Test', startDate, endDate });

		const startX = await getColumnCenterX(page, startDate);
		const rowY = await getRowCenterY(page, 0);
		const header = page.locator(`th.date-header[data-date="${startDate}"]`);
		const colWidth = (await header.boundingBox())!.width;

		await page.mouse.move(startX, rowY);
		await page.mouse.down();
		await page.mouse.move(startX + colWidth * 3, rowY, { steps: 10 });

		// Press Escape to cancel
		await page.keyboard.press('Escape');
		await page.mouse.up();

		// Wait for click suppression to expire
		await page.waitForTimeout(400);

		// Reservation should still be at original position
		await page.mouse.click(startX, rowY);
		await expect(modal(page)).toBeVisible();
		await expect(modal(page).locator('input[placeholder="Guest name"]')).toHaveValue('Cancel Test');
	});

	test('drag reservation to different site', async ({ page }) => {
		// Seed a second site via localStorage before reload
		await page.evaluate(() => {
			const data = JSON.parse(localStorage.getItem('rv-reservation-data') || '{}');
			if (!data.parkingLocations || data.parkingLocations.length < 2) {
				data.parkingLocations = data.parkingLocations || [];
				data.parkingLocations.push('Test Site B');
				localStorage.setItem('rv-reservation-data', JSON.stringify(data));
			}
		});
		await page.reload();
		await page.waitForSelector('.toolbar-title');
		await page.waitForTimeout(300);

		const startDate = offsetDate(1);
		const endDate = offsetDate(4);
		await createReservation(page, { name: 'Site Mover', startDate, endDate, rowIndex: 0 });

		const startX = await getColumnCenterX(page, startDate);
		const row0Y = await getRowCenterY(page, 0);
		const row1Y = await getRowCenterY(page, 1);
		const dy = row1Y - row0Y;

		// Drag from row 0 to row 1 (different site)
		await page.mouse.move(startX, row0Y);
		await page.mouse.down();
		await page.mouse.move(startX, row0Y + dy / 2, { steps: 5 });
		await page.mouse.move(startX, row0Y + dy, { steps: 5 });
		await page.mouse.up();

		await page.waitForTimeout(400);

		const toast = page.locator('.toast');
		await expect(toast).toContainText('Reservation moved');

		// Verify the reservation is now in the second row
		await page.mouse.click(startX, row1Y);
		await expect(modal(page)).toBeVisible();
		await expect(modal(page).locator('input[placeholder="Guest name"]')).toHaveValue('Site Mover');
	});
});
