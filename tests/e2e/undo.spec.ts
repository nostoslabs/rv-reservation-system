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

async function navigateToCustomers(page: Page) {
	await page.click('[data-testid="customers-link"]');
	await page.waitForURL(/\/customers$/);
}

async function triggerUndo(page: Page) {
	// Click body to ensure focus is not on an input (undo handler skips inputs)
	await page.locator('body').click({ position: { x: 10, y: 10 } });
	await page.keyboard.press('Control+z');
}

test.describe('Undo reservation operations', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('undo delete restores the reservation', async ({ page }) => {
		const start = offsetDate(2);
		const end = offsetDate(4);
		await createReservation(page, { name: 'Undo Test', startDate: start, endDate: end });

		// Verify reservation exists
		const occupiedCell = page.locator('td.grid-cell.occupied').first();
		await expect(occupiedCell).toBeVisible();

		// Open the reservation and delete it (two-click: first shows confirm, second deletes)
		await occupiedCell.click();
		await expect(modal(page)).toBeVisible();
		await modal(page).locator('button.danger').click();
		await modal(page).locator('button.danger').click();
		await expect(modal(page)).not.toBeVisible();

		// Reservation should be gone
		await expect(page.locator('td.grid-cell.occupied')).toHaveCount(0);

		// Undo
		await triggerUndo(page);
		await expect(page.locator('[data-testid="undone-toast"]')).toBeVisible();

		// Reservation should be back
		await expect(page.locator('td.grid-cell.occupied').first()).toBeVisible();
	});

	test('undo edit restores previous values', async ({ page }) => {
		const start = offsetDate(2);
		const end = offsetDate(4);
		await createReservation(page, { name: 'Original Name', startDate: start, endDate: end });

		// Edit the reservation
		await page.locator('td.grid-cell.occupied').first().click();
		await expect(modal(page)).toBeVisible();
		const nameInput = modal(page).locator('input[placeholder="Guest name"]');
		await nameInput.fill('Changed Name');
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Undo
		await triggerUndo(page);
		await expect(page.locator('[data-testid="undone-toast"]')).toBeVisible();

		// Re-open and verify original name is restored
		await page.locator('td.grid-cell.occupied').first().click();
		await expect(modal(page)).toBeVisible();
		await expect(nameInput).toHaveValue('Original Name');
	});
});

test.describe('Undo customer operations', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('undo delete restores the customer with same identity', async ({ page }) => {
		await navigateToCustomers(page);

		// Create a customer
		await page.click('[data-testid="add-customer-btn"]');
		await page.fill('[data-testid="customer-name-input"]', 'Undo Customer');
		await page.fill('[data-testid="customer-phone-input"]', '555-9999');
		await page.click('[data-testid="customer-save-btn"]');
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);

		// Delete the customer (open edit modal, two-click delete)
		await page.click('[data-testid="customer-row"]');
		await page.click('[data-testid="customer-delete-btn"]');
		await page.click('[data-testid="customer-delete-btn"]');

		// Customer should be gone
		await expect(page.locator('[data-testid="customer-empty-state"]')).toBeVisible();

		// Undo
		await triggerUndo(page);
		await expect(page.locator('[data-testid="undone-toast"]')).toBeVisible();

		// Customer should be back with same name and phone
		await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(1);
		await expect(page.locator('.customer-name')).toContainText('Undo Customer');
		await expect(page.locator('[data-testid="customer-row"]')).toContainText('555-9999');
	});
});
