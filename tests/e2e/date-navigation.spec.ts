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

test.describe('Date navigation', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('grid scrolls to booked date after creating a reservation', async ({ page }) => {
		// Click "+ New Reservation" button
		await page.click('[data-testid="new-reservation-btn"]');
		await expect(modal(page)).toBeVisible();

		// Book 14 days in the future (far enough that grid needs to scroll)
		const futureDate = offsetDate(14);
		const endDate = offsetDate(17);

		await modal(page).locator('[data-testid="guest-name-input"]').fill('Future Guest');
		await modal(page).locator('input[type="date"]').first().fill(futureDate);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Wait for scroll to settle
		await page.waitForTimeout(500);

		// The future date column should now be visible in the viewport
		const futureDateHeader = page.locator(`th.date-header[data-date="${futureDate}"]`);
		await expect(futureDateHeader).toBeVisible();
	});

	test('grid does not scroll after editing an existing reservation', async ({ page }) => {
		// First scroll to today
		await page.click('[data-testid="today-button"]');
		await page.waitForTimeout(300);

		// Get current scroll position
		const scrollBefore = await page.evaluate(() => {
			const scroller = document.querySelector('.sheet-scroll');
			return scroller?.scrollLeft ?? 0;
		});

		// Create a reservation for today
		const today = offsetDate(0);
		const endDate = offsetDate(3);
		await page.click('[data-testid="new-reservation-btn"]');
		await expect(modal(page)).toBeVisible();
		await modal(page).locator('[data-testid="guest-name-input"]').fill('Test Guest');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();
		await page.waitForTimeout(500);

		// Scroll back to today
		await page.click('[data-testid="today-button"]');
		await page.waitForTimeout(300);

		// Now open the reservation in edit mode
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();
		await expect(modal(page)).toBeVisible();

		// Get scroll position before edit save
		const scrollBeforeEdit = await page.evaluate(() => {
			const scroller = document.querySelector('.sheet-scroll');
			return scroller?.scrollLeft ?? 0;
		});

		// Save the edit (no changes)
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();
		await page.waitForTimeout(500);

		// Scroll should not have changed (edits don't trigger scroll)
		const scrollAfterEdit = await page.evaluate(() => {
			const scroller = document.querySelector('.sheet-scroll');
			return scroller?.scrollLeft ?? 0;
		});
		expect(scrollAfterEdit).toBe(scrollBeforeEdit);
	});

	test('Go To Date input is visible in toolbar', async ({ page }) => {
		const goToInput = page.locator('[data-testid="goto-date-input"]');
		await expect(goToInput).toBeVisible();
		await expect(goToInput).toHaveAttribute('type', 'date');
	});

	test('Today button still works', async ({ page }) => {
		const today = offsetDate(0);

		// Now click Today
		await page.click('[data-testid="today-button"]');
		await page.waitForTimeout(500);

		// Today's column should be visible
		const todayHeader = page.locator('th.date-header.today');
		await expect(todayHeader).toBeVisible();
	});
});
