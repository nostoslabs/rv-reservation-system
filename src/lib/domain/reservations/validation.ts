import { compareIsoDates, formatReservationDetail, isIsoDateString } from '$lib/date';
import {
	RESERVATION_COLORS,
	type Reservation,
	type ReservationColor,
	type ReservationFormValues
} from '$lib/domain/models';
import { normalizeName, normalizeReservationNotes, MAX_RESERVATION_NOTES_LENGTH } from './normalization';

export function isReservationColor(value: string): value is ReservationColor {
	return (RESERVATION_COLORS as readonly string[]).includes(value);
}

/**
 * Validate that start and end dates are valid ISO date strings
 * and that endDate is after startDate.
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
 * Validate a full reservation form including overlap checks.
 */
export function validateReservationForm(
	form: ReservationFormValues,
	options: {
		existingReservations: Reservation[];
		parkingLocations: string[];
	}
): string[] {
	const errors: string[] = [];
	const name = normalizeName(form.name);
	const notes = normalizeReservationNotes(form.notes);

	if (!name) {
		errors.push('Name is required.');
	}

	if (notes.length > MAX_RESERVATION_NOTES_LENGTH) {
		errors.push(`Notes must be ${MAX_RESERVATION_NOTES_LENGTH} characters or fewer.`);
	}

	errors.push(...validateReservationDates(form.startDate, form.endDate));

	if (!options.parkingLocations.includes(form.parkingLocation)) {
		errors.push('Parking location must be one of the existing locations.');
	}

	if (!isReservationColor(form.color)) {
		errors.push('Color must be one of: red, green, blue, yellow, pink, orange, purple.');
	}

	if (errors.length > 0) {
		return errors;
	}

	for (const reservation of options.existingReservations) {
		if (typeof form.index === 'number' && reservation.index === form.index) {
			continue;
		}

		if (reservation.parkingLocation !== form.parkingLocation) {
			continue;
		}

		if (checkOverlap(form.startDate, form.endDate, reservation.startDate, reservation.endDate)) {
			errors.push(
				`Overlap with reservation #${reservation.index} (${reservation.name}) at ${reservation.parkingLocation} from ${formatReservationDetail(reservation.startDate)} to ${formatReservationDetail(reservation.endDate)}.`
			);
			break;
		}
	}

	return errors;
}
