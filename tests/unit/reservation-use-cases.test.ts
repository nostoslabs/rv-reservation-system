import { describe, it, expect } from 'vitest';
import { createReservationUseCases } from '$lib/application/use-cases/reservation-use-cases';
import { buildFirstCellId } from '$lib/domain/reservations';
import type { PersistedAppData, ReservationFormValues } from '$lib/domain/models';

function makeAppData(overrides: Partial<PersistedAppData> = {}): PersistedAppData {
	return {
		version: 4,
		reservations: [],
		parkingLocations: ['A-01'],
		nextReservationIndex: 1,
		lastSavedAt: null,
		...overrides
	};
}

function makeForm(overrides: Partial<ReservationFormValues> = {}): ReservationFormValues {
	return {
		name: 'Test Guest',
		rvType: '',
		phoneNumber: '555-1234',
		notes: '',
		startDate: '2025-06-01',
		endDate: '2025-06-03',
		parkingLocation: 'A-01',
		color: 'blue',
		status: 'reserved',
		...overrides
	};
}

describe('ReservationUseCases', () => {
	describe('customerId round-trip', () => {
		it('persists customerId on new reservation', () => {
			const useCases = createReservationUseCases();
			const data = makeAppData();
			const form = makeForm({ customerId: 'cust-123' });

			const result = useCases.save(form, data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data!.reservations[0].customerId).toBe('cust-123');
			}
		});

		it('persists customerId on edit', () => {
			const useCases = createReservationUseCases();
			const data = makeAppData({
				reservations: [{
					index: 1,
					firstCellId: buildFirstCellId('A-01', '2025-06-01'),
					name: 'Test Guest',
					rvType: '',
					phoneNumber: '555-1234',
					notes: '',
					startDate: '2025-06-01',
					endDate: '2025-06-03',
					parkingLocation: 'A-01',
					color: 'blue',
					status: 'reserved',
					customerId: 'cust-123'
				}],
				nextReservationIndex: 2
			});

			const form = makeForm({ index: 1, customerId: 'cust-123', name: 'Updated Guest' });
			const result = useCases.save(form, data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data!.reservations[0].customerId).toBe('cust-123');
				expect(result.data!.reservations[0].name).toBe('Updated Guest');
			}
		});

		it('handles undefined customerId gracefully', () => {
			const useCases = createReservationUseCases();
			const data = makeAppData();
			const form = makeForm(); // no customerId

			const result = useCases.save(form, data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data!.reservations[0].customerId).toBeUndefined();
			}
		});
	});

	describe('move', () => {
		function makeDataWithReservation(overrides: Partial<PersistedAppData> = {}) {
			return makeAppData({
				parkingLocations: ['A-01', 'B-02'],
				reservations: [{
					index: 1,
					firstCellId: buildFirstCellId('A-01', '2025-06-10'),
					name: 'Move Guest',
					rvType: '',
					phoneNumber: '',
					notes: '',
					startDate: '2025-06-10',
					endDate: '2025-06-13',
					parkingLocation: 'A-01',
					color: 'blue',
					status: 'reserved'
				}],
				nextReservationIndex: 2,
				...overrides
			});
		}

		it('moves reservation forward by days', () => {
			const useCases = createReservationUseCases();
			const data = makeDataWithReservation();
			const result = useCases.move(1, 3, undefined, data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				const moved = result.data!.reservations[0];
				expect(moved.startDate).toBe('2025-06-13');
				expect(moved.endDate).toBe('2025-06-16');
				expect(moved.parkingLocation).toBe('A-01');
			}
		});

		it('moves reservation backward by days', () => {
			const useCases = createReservationUseCases();
			const data = makeDataWithReservation();
			const result = useCases.move(1, -5, undefined, data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				const moved = result.data!.reservations[0];
				expect(moved.startDate).toBe('2025-06-05');
				expect(moved.endDate).toBe('2025-06-08');
			}
		});

		it('moves reservation to a different site', () => {
			const useCases = createReservationUseCases();
			const data = makeDataWithReservation();
			const result = useCases.move(1, 0, 'B-02', data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				const moved = result.data!.reservations[0];
				expect(moved.parkingLocation).toBe('B-02');
				expect(moved.startDate).toBe('2025-06-10');
			}
		});

		it('rejects move that would cause overlap', () => {
			const useCases = createReservationUseCases();
			const data = makeDataWithReservation({
				reservations: [
					{
						index: 1,
						firstCellId: buildFirstCellId('A-01', '2025-06-10'),
						name: 'Move Guest',
						rvType: '',
						phoneNumber: '',
						notes: '',
						startDate: '2025-06-10',
						endDate: '2025-06-13',
						parkingLocation: 'A-01',
						color: 'blue',
						status: 'reserved'
					},
					{
						index: 2,
						firstCellId: buildFirstCellId('A-01', '2025-06-15'),
						name: 'Blocking Guest',
						rvType: '',
						phoneNumber: '',
						notes: '',
						startDate: '2025-06-15',
						endDate: '2025-06-18',
						parkingLocation: 'A-01',
						color: 'green',
						status: 'reserved'
					}
				],
				nextReservationIndex: 3
			});
			const result = useCases.move(1, 5, undefined, data);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('Overlap');
			}
		});

		it('rejects move for non-existent reservation', () => {
			const useCases = createReservationUseCases();
			const data = makeDataWithReservation();
			const result = useCases.move(999, 1, undefined, data);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toBe('Reservation not found.');
			}
		});

		it('rejects no-op move (same position)', () => {
			const useCases = createReservationUseCases();
			const data = makeDataWithReservation();
			const result = useCases.move(1, 0, undefined, data);
			expect(result.ok).toBe(false);
		});
	});
});
