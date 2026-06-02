import { afterEach, describe, it, expect, vi } from 'vitest';
import { createReservationUseCases } from '$lib/application/use-cases/reservation-use-cases';
import { buildFirstCellId } from '$lib/domain/reservations';
import type { AppDataRepository } from '$lib/application/ports';
import type { PersistedAppData, ReservationFormValues } from '$lib/types';

function createFakeRepo(): AppDataRepository {
	return {
		load: () => ({ version: 4, reservations: [], parkingLocations: [], nextReservationIndex: 1, lastSavedAt: null }),
		save: () => Date.now(),
		clear: () => {},
		getDefaultData: () => ({ version: 4, reservations: [], parkingLocations: [], nextReservationIndex: 1, lastSavedAt: null })
	};
}

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
		eta: '',
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
	afterEach(() => {
		vi.useRealTimers();
	});

	describe('reservation details', () => {
		it('records ETA and creation timestamp on new reservations', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-05-20T15:30:00.000Z'));
			const useCases = createReservationUseCases(createFakeRepo());

			const result = useCases.save(makeForm({ eta: '2 PM' }), makeAppData());

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data!.reservations[0].eta).toBe('2 PM');
				expect(result.data!.reservations[0].createdAt).toBe('2026-05-20T15:30:00.000Z');
			}
		});

		it('preserves creation timestamp when editing a reservation', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
			const useCases = createReservationUseCases(createFakeRepo());
			const data = makeAppData({
				reservations: [{
					index: 1,
					firstCellId: buildFirstCellId('A-01', '2025-06-01'),
					name: 'Test Guest',
					rvType: 'Class A',
					eta: '1 PM',
					phoneNumber: '555-1234',
					notes: '',
					startDate: '2025-06-01',
					endDate: '2025-06-03',
					parkingLocation: 'A-01',
					color: 'blue',
					status: 'reserved',
					createdAt: '2025-01-15T08:00:00.000Z'
				}],
				nextReservationIndex: 2
			});

			const result = useCases.save(makeForm({ index: 1, eta: '3 PM' }), data);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data!.reservations[0].eta).toBe('3 PM');
				expect(result.data!.reservations[0].createdAt).toBe('2025-01-15T08:00:00.000Z');
			}
		});
	});

	describe('customerId round-trip', () => {
		it('persists customerId on new reservation', () => {
			const useCases = createReservationUseCases(createFakeRepo());
			const data = makeAppData();
			const form = makeForm({ customerId: 'cust-123' });

			const result = useCases.save(form, data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data!.reservations[0].customerId).toBe('cust-123');
			}
		});

		it('persists customerId on edit', () => {
			const useCases = createReservationUseCases(createFakeRepo());
			const data = makeAppData({
				reservations: [{
					index: 1,
					firstCellId: buildFirstCellId('A-01', '2025-06-01'),
					name: 'Test Guest',
					rvType: '',
					eta: '',
					phoneNumber: '555-1234',
					notes: '',
					startDate: '2025-06-01',
					endDate: '2025-06-03',
					parkingLocation: 'A-01',
					color: 'blue',
					status: 'reserved',
					createdAt: '2025-01-01T00:00:00.000Z',
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
			const useCases = createReservationUseCases(createFakeRepo());
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
					eta: '',
					phoneNumber: '',
					notes: '',
					startDate: '2025-06-10',
					endDate: '2025-06-13',
					parkingLocation: 'A-01',
					color: 'blue',
					status: 'reserved',
					createdAt: '2025-01-01T00:00:00.000Z'
				}],
				nextReservationIndex: 2,
				...overrides
			});
		}

		it('moves reservation forward by days', () => {
			const useCases = createReservationUseCases(createFakeRepo());
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
			const useCases = createReservationUseCases(createFakeRepo());
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
			const useCases = createReservationUseCases(createFakeRepo());
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
			const useCases = createReservationUseCases(createFakeRepo());
			const data = makeDataWithReservation({
				reservations: [
					{
						index: 1,
						firstCellId: buildFirstCellId('A-01', '2025-06-10'),
						name: 'Move Guest',
						rvType: '',
						eta: '',
						phoneNumber: '',
						notes: '',
						startDate: '2025-06-10',
						endDate: '2025-06-13',
						parkingLocation: 'A-01',
						color: 'blue',
						status: 'reserved',
						createdAt: '2025-01-01T00:00:00.000Z'
					},
					{
						index: 2,
						firstCellId: buildFirstCellId('A-01', '2025-06-15'),
						name: 'Blocking Guest',
						rvType: '',
						eta: '',
						phoneNumber: '',
						notes: '',
						startDate: '2025-06-15',
						endDate: '2025-06-18',
						parkingLocation: 'A-01',
						color: 'green',
						status: 'reserved',
						createdAt: '2025-01-02T00:00:00.000Z'
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
			const useCases = createReservationUseCases(createFakeRepo());
			const data = makeDataWithReservation();
			const result = useCases.move(999, 1, undefined, data);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toBe('Reservation not found.');
			}
		});

		it('rejects no-op move (same position)', () => {
			const useCases = createReservationUseCases(createFakeRepo());
			const data = makeDataWithReservation();
			const result = useCases.move(1, 0, undefined, data);
			expect(result.ok).toBe(false);
		});
	});
});
