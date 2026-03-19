import { describe, it, expect } from 'vitest';
import { createReservationUseCases } from '$lib/application/use-cases/reservation-use-cases';
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
					firstCellId: 'A-01:2025-06-01',
					name: 'Test Guest',
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
});
