import { describe, expect, it } from 'vitest';
import {
	MAX_RESERVATION_NOTES_LENGTH,
	sanitizeReservationNotes,
	validateReservationForm
} from '$lib/domain/reservations';
import type { ReservationFormValues } from '$lib/types';
import { sanitizeReservation } from '$lib/storage';

function makeForm(overrides: Partial<ReservationFormValues> = {}): ReservationFormValues {
	return {
		name: 'Long Notes Guest',
		rvType: '',
		phoneNumber: '',
		notes: '',
		startDate: '2026-06-01',
		endDate: '2026-06-03',
		parkingLocation: 'A-01',
		color: 'blue',
		status: 'reserved',
		...overrides
	};
}

function makeStoredReservation(notes: string): Record<string, unknown> {
	return {
		index: 1,
		firstCellId: 'A-01::2026-06-01',
		name: 'Long Notes Guest',
		rvType: '',
		phoneNumber: '',
		notes,
		startDate: '2026-06-01',
		endDate: '2026-06-03',
		parkingLocation: 'A-01',
		color: 'blue',
		status: 'reserved'
	};
}

describe('reservation notes limit', () => {
	it('accepts notes at the 5,000 character limit', () => {
		const notes = 'N'.repeat(5000);

		const errors = validateReservationForm(makeForm({ notes }), {
			existingReservations: [],
			parkingLocations: ['A-01']
		});

		expect(MAX_RESERVATION_NOTES_LENGTH).toBe(5000);
		expect(errors).not.toContain('Notes must be 5000 characters or fewer.');
	});

	it('rejects notes over the 5,000 character limit', () => {
		const notes = 'N'.repeat(5001);

		const errors = validateReservationForm(makeForm({ notes }), {
			existingReservations: [],
			parkingLocations: ['A-01']
		});

		expect(errors).toContain('Notes must be 5000 characters or fewer.');
	});

	it('truncates sanitized reservation notes to 5,000 characters', () => {
		const notes = sanitizeReservationNotes('N'.repeat(5001));

		expect(notes).toHaveLength(5000);
	});

	it('preserves stored reservation notes up to 5,000 characters', () => {
		const notes = 'N'.repeat(5000);

		const reservation = sanitizeReservation(makeStoredReservation(notes));

		expect(reservation?.notes).toBe(notes);
	});
});
