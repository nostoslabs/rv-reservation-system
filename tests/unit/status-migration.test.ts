import { describe, it, expect } from 'vitest';
import {
	DEFAULT_RESERVATION_STATUS,
	STATUS_COLORS,
	STATUS_BACKGROUND_COLORS,
	STATUS_LABELS,
	isReservationStatus,
	getStatusColor,
	getStatusBackgroundColor,
	getStatusLabel
} from '$lib/domain/reservations/status';
import { RESERVATION_STATUSES } from '$lib/types';

describe('ReservationStatus type', () => {
	it('defines exactly seven statuses', () => {
		expect(RESERVATION_STATUSES).toEqual(['reserved', 'checked-in', 'group-one', 'group-two', 'special', 'alert', 'maintenance']);
	});

	it('default status is reserved', () => {
		expect(DEFAULT_RESERVATION_STATUS).toBe('reserved');
	});
});

describe('isReservationStatus', () => {
	it('returns true for all valid statuses', () => {
		expect(isReservationStatus('reserved')).toBe(true);
		expect(isReservationStatus('checked-in')).toBe(true);
		expect(isReservationStatus('group-one')).toBe(true);
		expect(isReservationStatus('group-two')).toBe(true);
		expect(isReservationStatus('special')).toBe(true);
		expect(isReservationStatus('alert')).toBe(true);
		expect(isReservationStatus('maintenance')).toBe(true);
	});

	it('returns false for invalid statuses', () => {
		expect(isReservationStatus('')).toBe(false);
		expect(isReservationStatus('active')).toBe(false);
		expect(isReservationStatus('cancelled')).toBe(false);
		expect(isReservationStatus('blue')).toBe(false);
	});

	it('returns false for removed due-out status', () => {
		expect(isReservationStatus('due-out')).toBe(false);
	});
});

describe('STATUS_COLORS', () => {
	it('maps reserved to blue (#3b82f6)', () => {
		expect(STATUS_COLORS['reserved']).toBe('#3b82f6');
	});

	it('maps checked-in to green (#22c55e)', () => {
		expect(STATUS_COLORS['checked-in']).toBe('#22c55e');
	});

	it('maps group-one to purple (#8b5cf6)', () => {
		expect(STATUS_COLORS['group-one']).toBe('#8b5cf6');
	});

	it('maps group-two to amber (#f59e0b)', () => {
		expect(STATUS_COLORS['group-two']).toBe('#f59e0b');
	});

	it('maps special to pink (#ec4899)', () => {
		expect(STATUS_COLORS['special']).toBe('#ec4899');
	});

	it('maps alert to red (#ef4444)', () => {
		expect(STATUS_COLORS['alert']).toBe('#ef4444');
	});

	it('maps maintenance to gray (#6b7280)', () => {
		expect(STATUS_COLORS['maintenance']).toBe('#6b7280');
	});
});

describe('STATUS_BACKGROUND_COLORS', () => {
	it('has a background color for every status', () => {
		for (const status of RESERVATION_STATUSES) {
			expect(STATUS_BACKGROUND_COLORS[status]).toBeDefined();
			expect(STATUS_BACKGROUND_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});

describe('STATUS_LABELS', () => {
	it('provides human-readable labels', () => {
		expect(STATUS_LABELS['reserved']).toBe('Reserved');
		expect(STATUS_LABELS['checked-in']).toBe('Checked In');
		expect(STATUS_LABELS['group-one']).toBe('Group One');
		expect(STATUS_LABELS['group-two']).toBe('Group Two');
		expect(STATUS_LABELS['special']).toBe('Special');
		expect(STATUS_LABELS['alert']).toBe('Alert');
		expect(STATUS_LABELS['maintenance']).toBe('Maintenance');
	});
});

describe('getStatusColor', () => {
	it('returns the correct color for each status', () => {
		expect(getStatusColor('reserved')).toBe('#3b82f6');
		expect(getStatusColor('checked-in')).toBe('#22c55e');
		expect(getStatusColor('group-one')).toBe('#8b5cf6');
		expect(getStatusColor('group-two')).toBe('#f59e0b');
		expect(getStatusColor('special')).toBe('#ec4899');
		expect(getStatusColor('alert')).toBe('#ef4444');
		expect(getStatusColor('maintenance')).toBe('#6b7280');
	});
});

describe('getStatusBackgroundColor', () => {
	it('returns a background color for each status', () => {
		for (const status of RESERVATION_STATUSES) {
			expect(getStatusBackgroundColor(status)).toBe(STATUS_BACKGROUND_COLORS[status]);
		}
	});
});

describe('getStatusLabel', () => {
	it('returns the label for each status', () => {
		for (const status of RESERVATION_STATUSES) {
			expect(getStatusLabel(status)).toBe(STATUS_LABELS[status]);
		}
	});
});

describe('storage migration v2 → v3', () => {
	it('existing reservations without status get default "reserved"', () => {
		const v2Reservation = {
			index: 1,
			firstCellId: 'A-01::2026-03-01',
			name: 'John Doe',
			phoneNumber: '555-1234',
			notes: '',
			startDate: '2026-03-01',
			endDate: '2026-03-05',
			parkingLocation: 'A-01',
			color: 'blue'
		};

		const status = typeof (v2Reservation as Record<string, unknown>).status === 'string' &&
			isReservationStatus((v2Reservation as Record<string, unknown>).status as string)
			? (v2Reservation as Record<string, unknown>).status
			: DEFAULT_RESERVATION_STATUS;

		expect(status).toBe('reserved');
	});

	it('preserves existing status if it is valid', () => {
		const v3Reservation = {
			index: 1,
			firstCellId: 'A-01::2026-03-01',
			name: 'Jane Smith',
			phoneNumber: '',
			notes: '',
			startDate: '2026-03-01',
			endDate: '2026-03-05',
			parkingLocation: 'A-01',
			color: 'green',
			status: 'checked-in'
		};

		const status = typeof v3Reservation.status === 'string' &&
			isReservationStatus(v3Reservation.status)
			? v3Reservation.status
			: DEFAULT_RESERVATION_STATUS;

		expect(status).toBe('checked-in');
	});

	it('falls back to default for invalid status values', () => {
		const badReservation = {
			index: 1,
			status: 'invalid-status'
		};

		const status = typeof badReservation.status === 'string' &&
			isReservationStatus(badReservation.status)
			? badReservation.status
			: DEFAULT_RESERVATION_STATUS;

		expect(status).toBe('reserved');
	});

	it('migrates removed due-out status to reserved', () => {
		const oldReservation = {
			index: 1,
			status: 'due-out'
		};

		const status = typeof oldReservation.status === 'string' &&
			isReservationStatus(oldReservation.status)
			? oldReservation.status
			: DEFAULT_RESERVATION_STATUS;

		expect(status).toBe('reserved');
	});
});
