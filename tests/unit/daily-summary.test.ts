import { describe, it, expect } from 'vitest';
import { computeDailySummary } from '$lib/domain/reservations/daily-summary';
import type { Reservation } from '$lib/types';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
	return {
		index: 1,
		firstCellId: 'A::2026-03-07',
		name: 'Test Guest',
		rvType: '',
		phoneNumber: '555-1234',
		notes: '',
		startDate: '2026-03-07',
		endDate: '2026-03-10',
		parkingLocation: 'A',
		color: 'blue',
		status: 'reserved',
		...overrides
	};
}

describe('computeDailySummary', () => {
	const sites = ['A', 'B', 'C'];
	const today = '2026-03-07';

	it('returns zeros when there are no reservations', () => {
		const result = computeDailySummary([], sites, today);
		expect(result).toEqual({
			arrivals: 0,
			departures: 0,
			occupied: 0,
			vacant: 3,
			totalSites: 3
		});
	});

	it('counts arrivals (startDate === today)', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-07', endDate: '2026-03-10', parkingLocation: 'A' }),
			makeReservation({ index: 2, startDate: '2026-03-07', endDate: '2026-03-09', parkingLocation: 'B' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.arrivals).toBe(2);
	});

	it('counts departures (endDate === today)', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-05', endDate: '2026-03-07', parkingLocation: 'A' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.departures).toBe(1);
	});

	it('handles arrivals only (no departures)', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-07', endDate: '2026-03-10', parkingLocation: 'A' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.arrivals).toBe(1);
		expect(result.departures).toBe(0);
	});

	it('handles departures only (no arrivals)', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-04', endDate: '2026-03-07', parkingLocation: 'B' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.arrivals).toBe(0);
		expect(result.departures).toBe(1);
	});

	it('handles mixed arrivals and departures', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-07', endDate: '2026-03-10', parkingLocation: 'A' }),
			makeReservation({ index: 2, startDate: '2026-03-04', endDate: '2026-03-07', parkingLocation: 'B' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.arrivals).toBe(1);
		expect(result.departures).toBe(1);
	});

	it('counts occupied sites correctly (reservation spans today)', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-05', endDate: '2026-03-09', parkingLocation: 'A' }),
			makeReservation({ index: 2, startDate: '2026-03-07', endDate: '2026-03-10', parkingLocation: 'B' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.occupied).toBe(2);
		expect(result.vacant).toBe(1);
	});

	it('does not count a site as occupied if reservation ends today (endDate is exclusive)', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-04', endDate: '2026-03-07', parkingLocation: 'A' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.occupied).toBe(0);
		expect(result.vacant).toBe(3);
	});

	it('counts vacancy as totalSites minus occupied', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-06', endDate: '2026-03-08', parkingLocation: 'A' }),
			makeReservation({ index: 2, startDate: '2026-03-06', endDate: '2026-03-08', parkingLocation: 'B' }),
			makeReservation({ index: 3, startDate: '2026-03-06', endDate: '2026-03-08', parkingLocation: 'C' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.occupied).toBe(3);
		expect(result.vacant).toBe(0);
		expect(result.totalSites).toBe(3);
	});

	it('handles empty sites list', () => {
		const result = computeDailySummary([], [], today);
		expect(result).toEqual({
			arrivals: 0,
			departures: 0,
			occupied: 0,
			vacant: 0,
			totalSites: 0
		});
	});

	it('only counts unique occupied sites (multiple reservations on same site)', () => {
		const reservations = [
			makeReservation({ index: 1, startDate: '2026-03-06', endDate: '2026-03-08', parkingLocation: 'A' }),
			makeReservation({ index: 2, startDate: '2026-03-07', endDate: '2026-03-09', parkingLocation: 'A' })
		];
		const result = computeDailySummary(reservations, sites, today);
		expect(result.occupied).toBe(1);
		expect(result.vacant).toBe(2);
	});
});
