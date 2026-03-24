import { describe, it, expect } from 'vitest';
import { filterReservations } from '$lib/domain/reservations/search';
import type { Reservation } from '$lib/types';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
	return {
		index: 1,
		firstCellId: 'A|2025-06-01',
		name: 'John Smith',
		rvType: '',
		phoneNumber: '555-1234',
		notes: '',
		startDate: '2025-06-01',
		endDate: '2025-06-05',
		parkingLocation: 'Site A',
		color: 'blue',
		status: 'reserved',
		...overrides
	};
}

const sampleReservations: Reservation[] = [
	makeReservation({ index: 1, name: 'Alice Johnson', parkingLocation: 'Site A' }),
	makeReservation({ index: 2, name: 'Bob Smith', parkingLocation: 'Site B' }),
	makeReservation({ index: 3, name: 'Charlie Brown', parkingLocation: 'Premium Lot' }),
	makeReservation({ index: 4, name: 'Alice Williams', parkingLocation: 'Site C' }),
	makeReservation({ index: 5, name: 'David Alice', parkingLocation: 'Site D' })
];

describe('filterReservations', () => {
	it('returns empty array for empty query', () => {
		expect(filterReservations(sampleReservations, '')).toEqual([]);
	});

	it('returns empty array for whitespace-only query', () => {
		expect(filterReservations(sampleReservations, '   ')).toEqual([]);
	});

	it('returns empty array when no reservations match', () => {
		expect(filterReservations(sampleReservations, 'Zephyr')).toEqual([]);
	});

	it('matches guest name case-insensitively', () => {
		const results = filterReservations(sampleReservations, 'alice');
		const names = results.map((r) => r.reservation.name);
		expect(names).toContain('Alice Johnson');
		expect(names).toContain('Alice Williams');
		expect(names).toContain('David Alice');
	});

	it('matches parking location case-insensitively', () => {
		const results = filterReservations(sampleReservations, 'site b');
		expect(results).toHaveLength(1);
		expect(results[0].reservation.name).toBe('Bob Smith');
	});

	it('ranks exact matches above partial matches', () => {
		const reservations = [
			makeReservation({ index: 1, name: 'Alice', parkingLocation: 'X' }),
			makeReservation({ index: 2, name: 'Alice Johnson', parkingLocation: 'Y' }),
			makeReservation({ index: 3, name: 'Wonderland Alice', parkingLocation: 'Z' })
		];
		const results = filterReservations(reservations, 'Alice');
		expect(results[0].reservation.name).toBe('Alice');
		expect(results[0].score).toBe(0);
	});

	it('ranks startsWith matches above contains matches', () => {
		const reservations = [
			makeReservation({ index: 1, name: 'Mary Alice', parkingLocation: 'X' }),
			makeReservation({ index: 2, name: 'Alice Johnson', parkingLocation: 'Y' })
		];
		const results = filterReservations(reservations, 'Alice');
		expect(results[0].reservation.name).toBe('Alice Johnson');
		expect(results[0].score).toBe(1);
		expect(results[1].reservation.name).toBe('Mary Alice');
		expect(results[1].score).toBe(2);
	});

	it('sorts alphabetically within the same score tier', () => {
		const results = filterReservations(sampleReservations, 'alice');
		// Alice Johnson and Alice Williams both startWith 'alice', David Alice contains 'alice'
		expect(results[0].reservation.name).toBe('Alice Johnson');
		expect(results[1].reservation.name).toBe('Alice Williams');
		expect(results[2].reservation.name).toBe('David Alice');
	});

	it('matches by parking location with exact match scoring', () => {
		const reservations = [
			makeReservation({ index: 1, name: 'Guest 1', parkingLocation: 'Premium Lot' }),
			makeReservation({ index: 2, name: 'Guest 2', parkingLocation: 'Premium' }),
			makeReservation({ index: 3, name: 'Guest 3', parkingLocation: 'Super Premium' })
		];
		const results = filterReservations(reservations, 'Premium');
		expect(results[0].reservation.parkingLocation).toBe('Premium');
		expect(results[0].score).toBe(0);
		expect(results[1].reservation.parkingLocation).toBe('Premium Lot');
		expect(results[1].score).toBe(1);
		expect(results[2].reservation.parkingLocation).toBe('Super Premium');
		expect(results[2].score).toBe(2);
	});

	it('takes best score when both name and location match', () => {
		const reservations = [
			makeReservation({ index: 1, name: 'Site Manager', parkingLocation: 'Site A' })
		];
		// 'Site' matches name via startsWith (score 1) and location via startsWith (score 1)
		const results = filterReservations(reservations, 'Site');
		expect(results).toHaveLength(1);
		expect(results[0].score).toBe(1);
	});

	it('works with empty reservations array', () => {
		expect(filterReservations([], 'test')).toEqual([]);
	});

	it('handles single-character query', () => {
		const results = filterReservations(sampleReservations, 'b');
		const names = results.map((r) => r.reservation.name);
		expect(names).toContain('Bob Smith');
		expect(names).toContain('Charlie Brown');
	});

	it('trims leading/trailing whitespace from query', () => {
		const results = filterReservations(sampleReservations, '  bob  ');
		expect(results).toHaveLength(1);
		expect(results[0].reservation.name).toBe('Bob Smith');
	});

	describe('phone number search', () => {
		const phoneReservations: Reservation[] = [
			makeReservation({ index: 1, name: 'Guest A', phoneNumber: '(555) 123-4567' }),
			makeReservation({ index: 2, name: 'Guest B', phoneNumber: '555-987-6543' }),
			makeReservation({ index: 3, name: 'Guest C', phoneNumber: '1234567890' }),
			makeReservation({ index: 4, name: 'Guest D', phoneNumber: '' })
		];

		it('matches phone number by partial digits', () => {
			const results = filterReservations(phoneReservations, '555');
			const names = results.map((r) => r.reservation.name);
			expect(names).toContain('Guest A');
			expect(names).toContain('Guest B');
		});

		it('matches phone number ignoring formatting', () => {
			const results = filterReservations(phoneReservations, '5551234567');
			expect(results).toHaveLength(1);
			expect(results[0].reservation.name).toBe('Guest A');
			expect(results[0].score).toBe(0);
		});

		it('matches phone with formatted query', () => {
			const results = filterReservations(phoneReservations, '(555) 123');
			const names = results.map((r) => r.reservation.name);
			expect(names).toContain('Guest A');
		});

		it('does not match reservations with empty phone number', () => {
			const results = filterReservations(phoneReservations, '999');
			const names = results.map((r) => r.reservation.name);
			expect(names).not.toContain('Guest D');
		});

		it('ranks exact phone match above partial', () => {
			const results = filterReservations(phoneReservations, '1234567890');
			expect(results[0].reservation.name).toBe('Guest C');
			expect(results[0].score).toBe(0);
		});

		it('matches phone with contains scoring', () => {
			const results = filterReservations(phoneReservations, '9876');
			expect(results).toHaveLength(1);
			expect(results[0].reservation.name).toBe('Guest B');
			expect(results[0].score).toBe(2);
		});
	});
});
