import { describe, it, expect } from 'vitest';
import {
	DEFAULT_RESERVATION_STATUS,
	STATUS_COLORS,
	STATUS_BACKGROUND_COLORS,
	STATUS_LABELS,
	STATUS_ICONS,
	isReservationStatus,
	getStatusColor,
	getStatusBackgroundColor,
	getStatusLabel,
	getStatusIcon
} from '$lib/domain/reservations/status';
import { RESERVATION_STATUSES } from '$lib/types';
import { sanitizeReservation } from '$lib/storage';

describe('ReservationStatus type', () => {
	it('defines exactly eight statuses', () => {
		expect(RESERVATION_STATUSES).toEqual(['reserved', 'checked-in', 'group-one', 'group-two', 'special', 'alert', 'maintenance', 'no-show']);
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
		expect(isReservationStatus('no-show')).toBe(true);
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

describe('STATUS_COLORS (Wong colorblind-safe palette)', () => {
	it('maps reserved to blue (#0072B2)', () => {
		expect(STATUS_COLORS['reserved']).toBe('#0072B2');
	});

	it('maps checked-in to teal (#009E73)', () => {
		expect(STATUS_COLORS['checked-in']).toBe('#009E73');
	});

	it('maps group-one to orange (#E69F00)', () => {
		expect(STATUS_COLORS['group-one']).toBe('#E69F00');
	});

	it('maps group-two to yellow (#F0E442)', () => {
		expect(STATUS_COLORS['group-two']).toBe('#F0E442');
	});

	it('maps special to rose (#CC79A7)', () => {
		expect(STATUS_COLORS['special']).toBe('#CC79A7');
	});

	it('maps alert to vermillion (#D55E00)', () => {
		expect(STATUS_COLORS['alert']).toBe('#D55E00');
	});

	it('maps maintenance to gray (#7B8A99)', () => {
		expect(STATUS_COLORS['maintenance']).toBe('#7B8A99');
	});

	it('maps no-show to purple (#882255)', () => {
		expect(STATUS_COLORS['no-show']).toBe('#882255');
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
		expect(STATUS_LABELS['no-show']).toBe('No-Show');
	});
});

describe('getStatusColor', () => {
	it('returns the correct color for each status', () => {
		expect(getStatusColor('reserved')).toBe('#0072B2');
		expect(getStatusColor('checked-in')).toBe('#009E73');
		expect(getStatusColor('group-one')).toBe('#E69F00');
		expect(getStatusColor('group-two')).toBe('#F0E442');
		expect(getStatusColor('special')).toBe('#CC79A7');
		expect(getStatusColor('alert')).toBe('#D55E00');
		expect(getStatusColor('maintenance')).toBe('#7B8A99');
		expect(getStatusColor('no-show')).toBe('#882255');
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

describe('STATUS_ICONS', () => {
	it('has an icon for every status', () => {
		for (const status of RESERVATION_STATUSES) {
			expect(STATUS_ICONS[status]).toBeDefined();
			expect(typeof STATUS_ICONS[status]).toBe('string');
			expect(STATUS_ICONS[status].length).toBeGreaterThan(0);
		}
	});
});

describe('getStatusIcon', () => {
	it('returns the icon for each status', () => {
		for (const status of RESERVATION_STATUSES) {
			expect(getStatusIcon(status)).toBe(STATUS_ICONS[status]);
		}
	});
});

describe('storage migration (sanitizeReservation)', () => {
	const validBase = {
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

	it('defaults missing status to "reserved" (pre-v3 data)', () => {
		const result = sanitizeReservation(validBase);
		expect(result).not.toBeNull();
		expect(result!.status).toBe('reserved');
	});

	it('preserves valid status', () => {
		const result = sanitizeReservation({ ...validBase, status: 'checked-in' });
		expect(result).not.toBeNull();
		expect(result!.status).toBe('checked-in');
	});

	it('falls back to default for invalid status values', () => {
		const result = sanitizeReservation({ ...validBase, status: 'invalid-status' });
		expect(result).not.toBeNull();
		expect(result!.status).toBe('reserved');
	});

	it('migrates removed due-out status to reserved', () => {
		const result = sanitizeReservation({ ...validBase, status: 'due-out' });
		expect(result).not.toBeNull();
		expect(result!.status).toBe('reserved');
	});
});
