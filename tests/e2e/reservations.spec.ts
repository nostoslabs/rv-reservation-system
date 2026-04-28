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

/** Click a grid cell by locating the date column via data-date attribute. */
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

/** Create a reservation via UI and verify modal closes. */
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

test.describe('Reservation CRUD', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('create a reservation via click', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'John Doe', startDate: today, endDate });

		// Scroll the first occupied cell into view and verify it shows
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied.locator('.reservation-label')).toContainText('John Doe');
	});

	test('edit an existing reservation', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'Jane Smith', startDate: today, endDate });

		// Find occupied cell, scroll to it, click to edit
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();
		await expect(modal(page)).toBeVisible();

		await expect(modal(page).locator('#reservation-modal-title')).toHaveText('Edit Reservation');
		await modal(page).locator('input[placeholder="Guest name"]').fill('Jane Updated');
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		const updated = page.locator('.grid-cell.occupied').first();
		await updated.scrollIntoViewIfNeeded();
		await expect(updated.locator('.reservation-label')).toContainText('Jane Updated');
	});

	test('delete a reservation', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(2);

		await createReservation(page, { name: 'To Delete', startDate: today, endDate });

		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();
		await expect(modal(page)).toBeVisible();

		// First click shows confirmation
		await modal(page).locator('button.danger').click();
		await expect(modal(page).locator('button.danger')).toContainText('Confirm Delete');

		// Second click actually deletes
		await modal(page).locator('button.danger').click();
		await expect(modal(page)).not.toBeVisible();

		// No occupied cells should remain
		await expect(page.locator('.grid-cell.occupied')).toHaveCount(0);
	});

	test('overlap rejection', async ({ page }) => {
		const startDate = offsetDate(1);
		const endDate = offsetDate(4);

		await createReservation(page, { name: 'First Guest', startDate, endDate });

		// Click an EMPTY cell in the same row (today, before the reservation)
		await clickCellAtDate(page, getTodayIso(), 0);
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

test.describe('Modal accessibility and UX', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('modal opens with focus on guest name field', async ({ page }) => {
		const today = getTodayIso();
		await clickCellAtDate(page, today, 0);
		await expect(modal(page)).toBeVisible();

		// Guest name input should be focused
		const nameInput = modal(page).locator('input[placeholder="Guest name"]');
		await expect(nameInput).toBeFocused();
	});

	test('close button dismisses modal', async ({ page }) => {
		const today = getTodayIso();
		await clickCellAtDate(page, today, 0);
		await expect(modal(page)).toBeVisible();

		// Click the X close button
		await modal(page).locator('[data-testid="modal-close-button"]').click();
		await expect(modal(page)).not.toBeVisible();
	});

	test('nights display shows correct count when both dates are set', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(5);
		await clickCellAtDate(page, today, 0);
		await expect(modal(page)).toBeVisible();

		// Set dates
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);

		// Nights display should show "5 nights"
		const nightsDisplay = modal(page).locator('[data-testid="nights-display"]');
		await expect(nightsDisplay).toBeVisible();
		await expect(nightsDisplay).toHaveText('5 nights');
	});

	test('nights display updates when dates change', async ({ page }) => {
		const today = getTodayIso();
		await clickCellAtDate(page, today, 0);
		await expect(modal(page)).toBeVisible();

		// Set for 3 nights
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(offsetDate(3));

		const nightsDisplay = modal(page).locator('[data-testid="nights-display"]');
		await expect(nightsDisplay).toHaveText('3 nights');

		// Change to 1 night
		await modal(page).locator('input[type="date"]').nth(1).fill(offsetDate(1));
		await expect(nightsDisplay).toHaveText('1 night');
	});
});

test.describe('New Reservation button', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('button is visible and opens modal in create mode', async ({ page }) => {
		const btn = page.getByTestId('new-reservation-btn');
		await expect(btn).toBeVisible();
		await expect(btn).toHaveText('+ New Reservation');

		await btn.click();
		await expect(modal(page)).toBeVisible();
		await expect(modal(page).locator('#reservation-modal-title')).toHaveText('New Reservation');
	});

	test('create a reservation via New Reservation button', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		await page.getByTestId('new-reservation-btn').click();
		await expect(modal(page)).toBeVisible();

		await modal(page).locator('input[placeholder="Guest name"]').fill('Button Guest');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);

		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Verify reservation appears in the grid
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await expect(occupied.locator('.reservation-label')).toContainText('Button Guest');
	});

	test('empty state prompt is shown when no reservations exist', async ({ page }) => {
		const emptyState = page.getByTestId('empty-state');
		await expect(emptyState).toBeVisible();
		await expect(emptyState).toContainText('No reservations yet');

		// Clicking inline action in empty state also opens modal
		await emptyState.locator('button.inline-action').click();
		await expect(modal(page)).toBeVisible();
		await expect(modal(page).locator('#reservation-modal-title')).toHaveText('New Reservation');
		await modal(page).locator('button:has-text("Cancel")').click();
		await expect(modal(page)).not.toBeVisible();
	});

	test('empty state disappears after creating a reservation', async ({ page }) => {
		const emptyState = page.getByTestId('empty-state');
		await expect(emptyState).toBeVisible();

		const today = getTodayIso();
		const endDate = offsetDate(2);

		await page.getByTestId('new-reservation-btn').click();
		await modal(page).locator('input[placeholder="Guest name"]').fill('First Res');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		await expect(emptyState).not.toBeVisible();
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

test.describe('Book Again (issue #15)', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('"Book Again" button is visible when editing an existing reservation', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'Returning Guest', startDate: today, endDate });

		// Open the reservation for editing
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();

		await expect(modal(page)).toBeVisible();
		await expect(modal(page).locator('#reservation-modal-title')).toHaveText('Edit Reservation');

		// Book Again button should be visible in edit mode
		await expect(modal(page).getByTestId('book-again-btn')).toBeVisible();
	});

	test('"Book Again" button is NOT visible in create mode', async ({ page }) => {
		const today = getTodayIso();
		await page.getByTestId('new-reservation-btn').click();

		await expect(modal(page)).toBeVisible();
		await expect(modal(page).locator('#reservation-modal-title')).toHaveText('New Reservation');

		// Book Again button should NOT appear in create mode
		await expect(modal(page).getByTestId('book-again-btn')).not.toBeVisible();
	});

	test('"Book Again" pre-fills name, phone, notes and site into a new reservation form', async ({
		page
	}) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		// Create a reservation with phone and notes
		await page.getByTestId('new-reservation-btn').click();
		await modal(page).locator('input[placeholder="Guest name"]').fill('Jane Returning');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('input[type="tel"]').fill('555-1234');
		await modal(page).locator('textarea').fill('Prefers site 1');
		// Note the selected parking location before saving
		const selectedSite = await modal(page).locator('select').first().inputValue();
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Open the reservation for editing
		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();
		await expect(modal(page)).toBeVisible();

		// Click Book Again
		await modal(page).getByTestId('book-again-btn').click();

		// Modal should now be in create mode with pre-filled guest details
		await expect(modal(page).locator('#reservation-modal-title')).toHaveText('New Reservation');
		await expect(modal(page).locator('input[placeholder="Guest name"]')).toHaveValue(
			'Jane Returning'
		);
		await expect(modal(page).locator('input[type="tel"]')).toHaveValue('555-1234');
		await expect(modal(page).locator('textarea')).toHaveValue('Prefers site 1');
		// Site (parking location) should also be pre-filled
		await expect(modal(page).locator('select').first()).toHaveValue(selectedSite);
	});

	test('"Book Again" new reservation uses today as default start date', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		await createReservation(page, { name: 'Repeat Guest', startDate: today, endDate });

		const occupied = page.locator('.grid-cell.occupied').first();
		await occupied.scrollIntoViewIfNeeded();
		await occupied.click();
		await expect(modal(page)).toBeVisible();

		await modal(page).getByTestId('book-again-btn').click();

		// Start date should default to today
		const startDateInput = modal(page).locator('input[type="date"]').first();
		await expect(startDateInput).toHaveValue(today);
	});
});

test.describe('Status legend (8 statuses)', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('status legend shows all 8 statuses with icons', async ({ page }) => {
		const legend = page.locator('.status-legend');
		await expect(legend).toBeVisible();

		const expectedLabels = ['Reserved', 'Checked In', 'Group One', 'Group Two', 'Special', 'Alert', 'Maintenance', 'No-Show'];
		for (const label of expectedLabels) {
			await expect(legend.getByText(label)).toBeVisible();
		}

		const legendItems = legend.locator('.legend-item');
		await expect(legendItems).toHaveCount(8);
	});

	test('reservation modal shows all 8 status options', async ({ page }) => {
		await page.getByTestId('new-reservation-btn').click();
		await expect(modal(page)).toBeVisible();

		const statusSelect = modal(page).locator('select[aria-label="Reservation status"]');
		const options = await statusSelect.locator('option').allTextContents();
		expect(options).toEqual(['Reserved', 'Checked In', 'Group One', 'Group Two', 'Special', 'Alert', 'Maintenance', 'No-Show']);
	});
});

test.describe('Phone number search', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('searching by phone number finds matching reservation', async ({ page }) => {
		const today = getTodayIso();
		const endDate = offsetDate(3);

		// Create a reservation with a phone number
		await page.getByTestId('new-reservation-btn').click();
		await modal(page).locator('input[placeholder="Guest name"]').fill('Phone Test');
		await modal(page).locator('input[type="date"]').first().fill(today);
		await modal(page).locator('input[type="date"]').nth(1).fill(endDate);
		await modal(page).locator('input[type="tel"]').fill('555-867-5309');
		await modal(page).locator('button[type="submit"]').click();
		await expect(modal(page)).not.toBeVisible();

		// Search by partial phone digits
		const searchInput = page.locator('input[placeholder="Search guests..."], input[aria-label="Search reservations"]');
		await searchInput.fill('8675');

		// Should see the matching reservation in results
		const dropdown = page.locator('.search-dropdown');
		await expect(dropdown).toBeVisible();
		await expect(dropdown.locator('.search-result-name')).toHaveText('Phone Test');
	});

	test('search dropdown renders above the grid, not clipped', async ({ page }) => {
		// Create multiple reservations with similar names on different dates to avoid overlap
		const names = ['Smith Alpha', 'Smith Beta', 'Smith Gamma'];
		for (let i = 0; i < names.length; i++) {
			const start = offsetDate(i * 5 + 1);
			const end = offsetDate(i * 5 + 3);
			await page.getByTestId('new-reservation-btn').click();
			await modal(page).locator('input[placeholder="Guest name"]').fill(names[i]);
			await modal(page).locator('input[type="date"]').first().fill(start);
			await modal(page).locator('input[type="date"]').nth(1).fill(end);
			await modal(page).locator('button[type="submit"]').click();
			await expect(modal(page)).not.toBeVisible();
		}

		const searchInput = page.locator('input[placeholder="Search guests..."], input[aria-label="Search reservations"]');
		await searchInput.fill('Smith');

		const dropdown = page.locator('.search-dropdown');
		await expect(dropdown).toBeVisible();

		// Should show all 3 results (not clipped to 1)
		const results = dropdown.locator('.search-result');
		await expect(results).toHaveCount(3);

		// Dropdown bottom should be within viewport (not clipped)
		const box = await dropdown.boundingBox();
		expect(box).toBeTruthy();
		const viewport = page.viewportSize();
		expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
	});
});

test.describe('Date picker UX', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('end date auto-advances to start + 1 when start date is set', async ({ page }) => {
		const start = offsetDate(5);
		const expectedEnd = offsetDate(6);

		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);

		await startInput.fill(start);
		await expect(endInput).toHaveValue(expectedEnd);
	});

	test('end date auto-advances when set before start date', async ({ page }) => {
		const start = offsetDate(10);
		const expectedEnd = offsetDate(11);

		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);

		// Set end date first, then start after it
		await endInput.fill(offsetDate(3));
		await startInput.fill(start);
		await expect(endInput).toHaveValue(expectedEnd);
	});

	test('end date is preserved when already after start date', async ({ page }) => {
		const start = offsetDate(5);
		const end = offsetDate(10);

		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);

		// Set dates in order — end should not change
		await startInput.fill(start);
		await endInput.fill(end);
		await expect(endInput).toHaveValue(end);
	});

	test('end date has min attribute set to day after start', async ({ page }) => {
		const start = offsetDate(5);
		const minEnd = offsetDate(6);

		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);

		await startInput.fill(start);
		await expect(endInput).toHaveAttribute('min', minEnd);
	});

	test('nights display updates when dates change', async ({ page }) => {
		const start = offsetDate(5);
		const end = offsetDate(8);

		await clickCellAtDate(page, getTodayIso());
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);

		await startInput.fill(start);
		await endInput.fill(end);

		await expect(modal(page).locator('[data-testid="nights-display"]')).toContainText('3 nights');
	});
});

test.describe('Site availability indicator (#134)', () => {
	test.beforeEach(async ({ page }) => {
		await resetApp(page);
	});

	test('marks the conflicting site as booked and disables it', async ({ page }) => {
		const start = offsetDate(5);
		const end = offsetDate(8);

		await createReservation(page, { name: 'Existing Guest', startDate: start, endDate: end, rowIndex: 0 });

		// Open new-reservation modal on a different row.
		await clickCellAtDate(page, getTodayIso(), 1);
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);
		await startInput.fill(start);
		await endInput.fill(end);

		const siteSelect = modal(page).locator('[data-testid="site-select"]');
		const firstSite = await siteSelect.locator('option').nth(0).getAttribute('value');
		expect(firstSite).toBeTruthy();

		const bookedOption = siteSelect.locator(`option[value="${firstSite}"]`);
		await expect(bookedOption).toContainText('booked');
		await expect(bookedOption).toHaveAttribute('disabled', '');
	});

	test('clears the booked indicator when dates no longer conflict', async ({ page }) => {
		const start = offsetDate(5);
		const end = offsetDate(8);

		await createReservation(page, { name: 'Existing Guest', startDate: start, endDate: end, rowIndex: 0 });

		await clickCellAtDate(page, getTodayIso(), 1);
		await expect(modal(page)).toBeVisible();

		const startInput = modal(page).locator('input[type="date"]').first();
		const endInput = modal(page).locator('input[type="date"]').nth(1);
		const siteSelect = modal(page).locator('[data-testid="site-select"]');
		const firstSite = await siteSelect.locator('option').nth(0).getAttribute('value');

		await startInput.fill(start);
		await endInput.fill(end);
		await expect(siteSelect.locator(`option[value="${firstSite}"]`)).toContainText('booked');

		// Move dates well past the existing reservation.
		await startInput.fill(offsetDate(20));
		await endInput.fill(offsetDate(23));
		await expect(siteSelect.locator(`option[value="${firstSite}"]`)).not.toContainText('booked');
		await expect(siteSelect.locator(`option[value="${firstSite}"]`)).not.toHaveAttribute('disabled', '');
	});

	test('does not mark the reservation own site as booked when editing it', async ({ page }) => {
		const start = offsetDate(5);
		const end = offsetDate(8);

		await createReservation(page, { name: 'Editable Guest', startDate: start, endDate: end, rowIndex: 0 });

		// Re-open the reservation by clicking its starting cell.
		await clickCellAtDate(page, start, 0);
		await expect(modal(page)).toBeVisible();

		const siteSelect = modal(page).locator('[data-testid="site-select"]');
		const ownSite = await siteSelect.inputValue();
		await expect(siteSelect.locator(`option[value="${ownSite}"]`)).not.toContainText('booked');
	});
});
