import { compareIsoDates, isIsoDateString } from '$lib/date';

/**
 * Validate that start and end dates are valid ISO date strings
 * and that endDate is after startDate.
 * Returns an array of error messages (empty if valid).
 */
export function validateReservationDates(startDate: string, endDate: string): string[] {
	const errors: string[] = [];

	if (!isIsoDateString(startDate)) {
		errors.push('Start date must be a valid date.');
	}

	if (!isIsoDateString(endDate)) {
		errors.push('End date must be a valid date.');
	}

	if (isIsoDateString(startDate) && isIsoDateString(endDate)) {
		if (compareIsoDates(startDate, endDate) >= 0) {
			errors.push('End date must be after start date.');
		}
	}

	return errors;
}

/**
 * Check if two date ranges overlap.
 * Both ranges are [start, end) — start-inclusive, end-exclusive.
 */
export function checkOverlap(
	startA: string,
	endAExclusive: string,
	startB: string,
	endBExclusive: string
): boolean {
	return compareIsoDates(startA, endBExclusive) < 0 && compareIsoDates(startB, endAExclusive) < 0;
}

/**
 * Normalize a date pair: validates both dates and returns them
 * if valid, or null if either date is invalid.
 */
export function normalizeDates(
	startDate: string,
	endDate: string
): { startDate: string; endDate: string } | null {
	if (!isIsoDateString(startDate) || !isIsoDateString(endDate)) {
		return null;
	}
	return { startDate, endDate };
}
