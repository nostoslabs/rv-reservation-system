import { describe, it, expect } from 'vitest';
import { createParkingLocationUseCases } from '$lib/application/use-cases/parking-location-use-cases';
import type { PersistedAppData } from '$lib/domain/models';

const stubRepo = { load: () => baseData(), getDefaultData: () => baseData(), save: () => 0, clear: () => {} };
const useCases = createParkingLocationUseCases(stubRepo);

function baseData(overrides?: Partial<PersistedAppData>): PersistedAppData {
	return {
		version: 4,
		reservations: [],
		parkingLocations: ['A-01', 'A-02', 'B-01'],
		nextReservationIndex: 1,
		lastSavedAt: null,
		...overrides
	};
}

describe('ParkingLocationUseCases', () => {
describe('reorder', () => {
	it('reorders locations to the given order', () => {
		const result = useCases.reorder(['B-01', 'A-02', 'A-01'], baseData());
		expect(result.ok).toBe(true);
		expect(result.data!.parkingLocations).toEqual(['B-01', 'A-02', 'A-01']);
	});

	it('rejects if count does not match', () => {
		const result = useCases.reorder(['A-01', 'A-02'], baseData());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors).toContain('Location count mismatch.');
	});

	it('rejects if names differ', () => {
		const result = useCases.reorder(['A-01', 'A-02', 'UNKNOWN'], baseData());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors).toContain('Reordered list must contain the same locations.');
	});

	it('accepts same order (no-op)', () => {
		const result = useCases.reorder(['A-01', 'A-02', 'B-01'], baseData());
		expect(result.ok).toBe(true);
		expect(result.data!.parkingLocations).toEqual(['A-01', 'A-02', 'B-01']);
	});

	it('does not alter reservations', () => {
		const data = baseData({
			reservations: [{
				index: 1, firstCellId: 'A-01|2026-03-01', name: 'Test',
				phoneNumber: '', notes: '', startDate: '2026-03-01', endDate: '2026-03-02',
				parkingLocation: 'A-01', color: 'blue', status: 'reserved'
			}]
		});
		const result = useCases.reorder(['B-01', 'A-02', 'A-01'], data);
		expect(result.ok).toBe(true);
		expect(result.data!.reservations).toEqual(data.reservations);
	});
});
});
