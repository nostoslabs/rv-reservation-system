import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ReservationStatus domain model', () => {
	it('STATUS_COLORS maps all statuses to hex colors', async () => {
		const { STATUS_COLORS } = await import('$lib/domain/reservations/status');
		expect(STATUS_COLORS['reserved']).toBe('#3b82f6');
		expect(STATUS_COLORS['checked-in']).toBe('#22c55e');
		expect(STATUS_COLORS['due-out']).toBe('#f59e0b');
		expect(STATUS_COLORS['maintenance']).toBe('#6b7280');
	});

	it('STATUS_LABELS maps all statuses to human-readable labels', async () => {
		const { STATUS_LABELS } = await import('$lib/domain/reservations/status');
		expect(STATUS_LABELS['reserved']).toBe('Reserved');
		expect(STATUS_LABELS['checked-in']).toBe('Checked In');
		expect(STATUS_LABELS['due-out']).toBe('Due Out');
		expect(STATUS_LABELS['maintenance']).toBe('Maintenance');
	});

	it('STATUS_BG_COLORS maps all statuses to background tints', async () => {
		const { STATUS_BG_COLORS } = await import('$lib/domain/reservations/status');
		expect(STATUS_BG_COLORS['reserved']).toBe('#dbeafe');
		expect(STATUS_BG_COLORS['checked-in']).toBe('#dcfce7');
		expect(STATUS_BG_COLORS['due-out']).toBe('#fef3c7');
		expect(STATUS_BG_COLORS['maintenance']).toBe('#f3f4f6');
	});

	it('DEFAULT_RESERVATION_STATUS is reserved', async () => {
		const { DEFAULT_RESERVATION_STATUS } = await import('$lib/domain/reservations/status');
		expect(DEFAULT_RESERVATION_STATUS).toBe('reserved');
	});

	it('isReservationStatus returns true for valid statuses', async () => {
		const { isReservationStatus } = await import('$lib/domain/reservations/status');
		expect(isReservationStatus('reserved')).toBe(true);
		expect(isReservationStatus('checked-in')).toBe(true);
		expect(isReservationStatus('due-out')).toBe(true);
		expect(isReservationStatus('maintenance')).toBe(true);
	});

	it('isReservationStatus returns false for invalid values', async () => {
		const { isReservationStatus } = await import('$lib/domain/reservations/status');
		expect(isReservationStatus('unknown')).toBe(false);
		expect(isReservationStatus('')).toBe(false);
		expect(isReservationStatus('blue')).toBe(false);
	});

	it('getStatusColor returns the correct color for each status', async () => {
		const { getStatusColor } = await import('$lib/domain/reservations/status');
		expect(getStatusColor('reserved')).toBe('#3b82f6');
		expect(getStatusColor('maintenance')).toBe('#6b7280');
	});

	it('getStatusBgColor returns the correct background for each status', async () => {
		const { getStatusBgColor } = await import('$lib/domain/reservations/status');
		expect(getStatusBgColor('reserved')).toBe('#dbeafe');
		expect(getStatusBgColor('checked-in')).toBe('#dcfce7');
	});

	it('getStatusLabel returns the correct label for each status', async () => {
		const { getStatusLabel } = await import('$lib/domain/reservations/status');
		expect(getStatusLabel('reserved')).toBe('Reserved');
		expect(getStatusLabel('due-out')).toBe('Due Out');
	});
});

describe('v2 to v3 storage migration', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('assigns default status "reserved" to existing reservations without status', async () => {
		// Simulate a v2 payload (no status field on reservations)
		const v2Data = {
			version: 2,
			reservations: [
				{
					index: 1,
					firstCellId: 'A-01::2025-03-01',
					name: 'Test Guest',
					phoneNumber: '555-1234',
					notes: 'Some notes',
					startDate: '2025-03-01',
					endDate: '2025-03-05',
					parkingLocation: 'A-01',
					color: 'blue'
				}
			],
			parkingLocations: ['A-01', 'A-02'],
			nextReservationIndex: 2,
			lastSavedAt: 1234567890
		};

		// Mock the browser environment and localStorage
		vi.doMock('$app/environment', () => ({ browser: true }));

		const mockStorage = new Map<string, string>();
		mockStorage.set('rv-reservation-demo:v1', JSON.stringify(v2Data));

		const origLocalStorage = globalThis.window?.localStorage;
		Object.defineProperty(globalThis, 'window', {
			value: {
				localStorage: {
					getItem: (key: string) => mockStorage.get(key) ?? null,
					setItem: (key: string, value: string) => mockStorage.set(key, value),
					removeItem: (key: string) => mockStorage.delete(key),
					clear: () => mockStorage.clear()
				}
			},
			writable: true,
			configurable: true
		});

		try {
			const { loadPersistedAppData } = await import('$lib/storage');
			const data = loadPersistedAppData();

			expect(data.version).toBe(3);
			expect(data.reservations).toHaveLength(1);
			expect(data.reservations[0].status).toBe('reserved');
			expect(data.reservations[0].color).toBe('blue');
			expect(data.reservations[0].name).toBe('Test Guest');
		} finally {
			if (origLocalStorage) {
				Object.defineProperty(globalThis, 'window', {
					value: { localStorage: origLocalStorage },
					writable: true,
					configurable: true
				});
			}
		}
	});

	it('preserves existing status when present in v3 data', async () => {
		const v3Data = {
			version: 3,
			reservations: [
				{
					index: 1,
					firstCellId: 'A-01::2025-03-01',
					name: 'Test Guest',
					phoneNumber: '555-1234',
					notes: '',
					startDate: '2025-03-01',
					endDate: '2025-03-05',
					parkingLocation: 'A-01',
					color: 'blue',
					status: 'checked-in'
				}
			],
			parkingLocations: ['A-01'],
			nextReservationIndex: 2,
			lastSavedAt: 1234567890
		};

		vi.doMock('$app/environment', () => ({ browser: true }));

		const mockStorage = new Map<string, string>();
		mockStorage.set('rv-reservation-demo:v1', JSON.stringify(v3Data));

		const origLocalStorage = globalThis.window?.localStorage;
		Object.defineProperty(globalThis, 'window', {
			value: {
				localStorage: {
					getItem: (key: string) => mockStorage.get(key) ?? null,
					setItem: (key: string, value: string) => mockStorage.set(key, value),
					removeItem: (key: string) => mockStorage.delete(key),
					clear: () => mockStorage.clear()
				}
			},
			writable: true,
			configurable: true
		});

		try {
			const { loadPersistedAppData } = await import('$lib/storage');
			const data = loadPersistedAppData();

			expect(data.reservations[0].status).toBe('checked-in');
		} finally {
			if (origLocalStorage) {
				Object.defineProperty(globalThis, 'window', {
					value: { localStorage: origLocalStorage },
					writable: true,
					configurable: true
				});
			}
		}
	});

	it('new reservations get default status', async () => {
		const { DEFAULT_RESERVATION_STATUS } = await import('$lib/domain/reservations/status');
		expect(DEFAULT_RESERVATION_STATUS).toBe('reserved');
	});
});
