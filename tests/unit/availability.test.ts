import { describe, it, expect } from 'vitest';
import { computeLocationAvailability } from '$lib/domain/reservations/availability';
import type { Reservation } from '$lib/types';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
	return {
		index: 1,
		firstCellId: 'A|2025-06-01',
		name: 'Guest',
		rvType: '',
		phoneNumber: '',
		notes: '',
		startDate: '2025-06-01',
		endDate: '2025-06-05',
		parkingLocation: 'Site A',
		color: 'blue',
		status: 'reserved',
		...overrides
	};
}

const LOCATIONS = ['Site A', 'Site B', 'Site C'];

describe('computeLocationAvailability', () => {
	it('returns all available when startDate is empty', () => {
		const result = computeLocationAvailability('', '2025-06-05', LOCATIONS, [
			makeReservation({ parkingLocation: 'Site A' })
		]);
		expect(result.every((r) => r.isAvailable)).toBe(true);
	});

	it('returns all available when endDate is empty', () => {
		const result = computeLocationAvailability('2025-06-01', '', LOCATIONS, [
			makeReservation({ parkingLocation: 'Site A' })
		]);
		expect(result.every((r) => r.isAvailable)).toBe(true);
	});

	it('returns all available when endDate is not after startDate', () => {
		const result = computeLocationAvailability('2025-06-05', '2025-06-05', LOCATIONS, [
			makeReservation({ parkingLocation: 'Site A' })
		]);
		expect(result.every((r) => r.isAvailable)).toBe(true);
	});

	it('returns all available when no existing reservations conflict', () => {
		const result = computeLocationAvailability('2025-07-01', '2025-07-05', LOCATIONS, [
			makeReservation({ parkingLocation: 'Site A', startDate: '2025-06-01', endDate: '2025-06-05' })
		]);
		expect(result.every((r) => r.isAvailable)).toBe(true);
	});

	it('marks the conflicting location as booked with the reservation index', () => {
		const result = computeLocationAvailability('2025-06-02', '2025-06-04', LOCATIONS, [
			makeReservation({ index: 42, parkingLocation: 'Site A' })
		]);
		const a = result.find((r) => r.location === 'Site A');
		const b = result.find((r) => r.location === 'Site B');
		expect(a).toEqual({ location: 'Site A', isAvailable: false, conflictingReservationIndex: 42 });
		expect(b).toEqual({ location: 'Site B', isAvailable: true });
	});

	it('treats adjacent ranges as available (end is exclusive)', () => {
		// Existing reservation ends 2025-06-05 (exclusive); new reservation starts 2025-06-05.
		const result = computeLocationAvailability('2025-06-05', '2025-06-08', LOCATIONS, [
			makeReservation({ parkingLocation: 'Site A', startDate: '2025-06-01', endDate: '2025-06-05' })
		]);
		expect(result.find((r) => r.location === 'Site A')?.isAvailable).toBe(true);
	});

	it('detects partial overlap on the trailing edge', () => {
		const result = computeLocationAvailability('2025-06-04', '2025-06-08', LOCATIONS, [
			makeReservation({ parkingLocation: 'Site A', startDate: '2025-06-01', endDate: '2025-06-05' })
		]);
		expect(result.find((r) => r.location === 'Site A')?.isAvailable).toBe(false);
	});

	it('excludes the reservation being edited from the conflict check', () => {
		const result = computeLocationAvailability(
			'2025-06-02',
			'2025-06-04',
			LOCATIONS,
			[makeReservation({ index: 7, parkingLocation: 'Site A' })],
			7
		);
		expect(result.find((r) => r.location === 'Site A')?.isAvailable).toBe(true);
	});

	it('returns the first conflicting reservation when multiple overlap', () => {
		const result = computeLocationAvailability('2025-06-01', '2025-06-30', LOCATIONS, [
			makeReservation({ index: 1, parkingLocation: 'Site A', startDate: '2025-06-02', endDate: '2025-06-05' }),
			makeReservation({ index: 2, parkingLocation: 'Site A', startDate: '2025-06-10', endDate: '2025-06-12' })
		]);
		expect(result.find((r) => r.location === 'Site A')?.conflictingReservationIndex).toBe(1);
	});

	it('preserves the order of input parkingLocations', () => {
		const result = computeLocationAvailability('2025-07-01', '2025-07-05', LOCATIONS, []);
		expect(result.map((r) => r.location)).toEqual(LOCATIONS);
	});
});
