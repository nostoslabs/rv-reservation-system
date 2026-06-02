import { describe, expect, it } from 'vitest';
import { countCurrentAndFutureReservations } from '$lib/domain/reservations';
import type { Reservation } from '$lib/types';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
	return {
		index: 1,
		firstCellId: 'A-01::2026-05-01',
		name: 'Test Guest',
		rvType: '',
		eta: '',
		phoneNumber: '',
		notes: '',
		startDate: '2026-05-01',
		endDate: '2026-05-05',
		parkingLocation: 'A-01',
		color: 'blue',
		status: 'reserved',
		createdAt: '2026-04-01T00:00:00.000Z',
		...overrides
	};
}

describe('countCurrentAndFutureReservations', () => {
	it('counts reservations that have not fully checked out', () => {
		const reservations = [
			makeReservation({ index: 1, endDate: '2026-05-22' }),
			makeReservation({ index: 2, endDate: '2026-05-23' }),
			makeReservation({ index: 3, endDate: '2026-05-24' })
		];

		expect(countCurrentAndFutureReservations(reservations, '2026-05-23')).toBe(2);
	});

	it('updates when the supplied today date advances', () => {
		const reservations = [
			makeReservation({ index: 1, endDate: '2026-05-23' }),
			makeReservation({ index: 2, endDate: '2026-05-24' })
		];

		expect(countCurrentAndFutureReservations(reservations, '2026-05-23')).toBe(2);
		expect(countCurrentAndFutureReservations(reservations, '2026-05-24')).toBe(1);
	});
});
