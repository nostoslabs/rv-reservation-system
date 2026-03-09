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
const compactToggle = (page: Page) => page.locator('[data-testid="compact-toggle"]');

test.describe('Compact View Toggle', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('toggle button is visible with aria-pressed=false by default', async ({ page }) => {
		const toggle = compactToggle(page);
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	});

	test('clicking toggle reduces cell height', async ({ page }) => {
		const cell = page.locator('.grid-cell').first();
		await cell.scrollIntoViewIfNeeded();
		const normalHeight = (await cell.boundingBox())!.height;

		await compactToggle(page).click();
		await page.waitForTimeout(200);

		await cell.scrollIntoViewIfNeeded();
		const compactHeight = (await cell.boundingBox())!.height;

		expect(compactHeight).toBeLessThan(normalHeight);
		await expect(compactToggle(page)).toHaveAttribute('aria-pressed', 'true');
	});

	test('compact mode persists across page reload', async ({ page }) => {
		await compactToggle(page).click();
		await page.waitForTimeout(200);
		await expect(compactToggle(page)).toHaveAttribute('aria-pressed', 'true');

		await page.reload();
		await page.waitForSelector('.toolbar-title');
		await page.waitForTimeout(300);

		await expect(compactToggle(page)).toHaveAttribute('aria-pressed', 'true');

		const cell = page.locator('.grid-cell').first();
		await cell.scrollIntoViewIfNeeded();
		const height = (await cell.boundingBox())!.height;
		expect(height).toBeLessThanOrEqual(30);
	});

	test('today column stays visible after toggling to compact', async ({ page }) => {
		const today = getTodayIso();
		await compactToggle(page).click();
		await page.waitForTimeout(300);

		await expect(page.locator(`th.date-header[data-date="${today}"]`)).toBeVisible();
	});

	test('reservation CRUD works in compact mode', async ({ page }) => {
		await compactToggle(page).click();
		await page.waitForTimeout(200);

		const today = getTodayIso();
		const endDate = offsetDate(3);

		// Find today's column index
		const colIndex = await page.evaluate((date) => {
			const headers = document.querySelectorAll('th.date-header[data-date]');
			for (let i = 0; i < headers.length; i++) {
				if (headers[i].getAttribute('data-date') === date) return i;
			}
			return -1;
		}, today);
		expect(colIndex).toBeGreaterThanOrEqual(0);

		const cell = page.locator('tbody tr').first().locator('td.grid-cell').nth(colIndex);
		await cell.scrollIntoViewIfNeeded();
		await cell.click();
		await expect(modal(page)).toBeVisible();

		await modal(page).locator('input[placeholder="Guest name"]').fill('Compact Guest');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Verify label is visible in compact mode
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied.locator('.reservation-label')).toContainText('Compact Guest');
	});

	test('toggling back to normal restores full size', async ({ page }) => {
		const cell = page.locator('.grid-cell').first();
		await cell.scrollIntoViewIfNeeded();
		const normalHeight = (await cell.boundingBox())!.height;

		// Toggle to compact
		await compactToggle(page).click();
		await page.waitForTimeout(200);

		// Toggle back to normal
		await compactToggle(page).click();
		await page.waitForTimeout(200);

		await expect(compactToggle(page)).toHaveAttribute('aria-pressed', 'false');
		await cell.scrollIntoViewIfNeeded();
		const restoredHeight = (await cell.boundingBox())!.height;
		expect(restoredHeight).toBeCloseTo(normalHeight, 0);
	});
});
