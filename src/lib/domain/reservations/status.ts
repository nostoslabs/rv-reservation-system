import {
	RESERVATION_STATUSES,
	type ReservationStatus
} from '$lib/domain/models';

export const DEFAULT_RESERVATION_STATUS: ReservationStatus = 'reserved';

export const STATUS_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#0072B2',
	'checked-in': '#009E73',
	'group-one': '#E69F00',
	'group-two': '#F0E442',
	'special': '#CC79A7',
	'alert': '#D55E00',
	'maintenance': '#56B4E9'
};

export const STATUS_BACKGROUND_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#b0d4f1',
	'checked-in': '#9edbc8',
	'group-one': '#f5d898',
	'group-two': '#f0ec8a',
	'special': '#e8c2d9',
	'alert': '#f0bfa5',
	'maintenance': '#aad8f0'
};

export const STATUS_PATTERNS: Record<ReservationStatus, string> = {
	'reserved': 'none',
	'checked-in': 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 6px)',
	'group-one': 'radial-gradient(circle, rgba(0,0,0,0.10) 1px, transparent 1px)',
	'group-two': 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.07) 4px, rgba(0,0,0,0.07) 6px), repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.07) 4px, rgba(0,0,0,0.07) 6px)',
	'special': 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 6px)',
	'alert': 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(0,0,0,0.10) 3px, rgba(0,0,0,0.10) 5px)',
	'maintenance': 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 6px)'
};

export const STATUS_PATTERN_SIZES: Record<ReservationStatus, string> = {
	'reserved': 'auto',
	'checked-in': 'auto',
	'group-one': '8px 8px',
	'group-two': 'auto',
	'special': 'auto',
	'alert': 'auto',
	'maintenance': 'auto'
};

export const STATUS_ICONS: Record<ReservationStatus, string> = {
	'reserved': '\u{1F4CB}',
	'checked-in': '\u2705',
	'group-one': '\u{1F465}',
	'group-two': '\u{1F46A}',
	'special': '\u2B50',
	'alert': '\u26A0\uFE0F',
	'maintenance': '\u{1F527}'
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
	'reserved': 'Reserved',
	'checked-in': 'Checked In',
	'group-one': 'Group One',
	'group-two': 'Group Two',
	'special': 'Special',
	'alert': 'Alert',
	'maintenance': 'Maintenance'
};

export function isReservationStatus(value: string): value is ReservationStatus {
	return (RESERVATION_STATUSES as readonly string[]).includes(value);
}

export function getStatusColor(status: ReservationStatus): string {
	return STATUS_COLORS[status];
}

export function getStatusBackgroundColor(status: ReservationStatus): string {
	return STATUS_BACKGROUND_COLORS[status];
}

export function getStatusIcon(status: ReservationStatus): string {
	return STATUS_ICONS[status];
}

export function getStatusLabel(status: ReservationStatus): string {
	return STATUS_LABELS[status];
}

export function getStatusPattern(status: ReservationStatus): string {
	return STATUS_PATTERNS[status];
}

export function getStatusPatternSize(status: ReservationStatus): string {
	return STATUS_PATTERN_SIZES[status];
}
