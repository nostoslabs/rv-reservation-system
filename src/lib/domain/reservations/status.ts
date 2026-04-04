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
	'maintenance': '#7B8A99',
	'no-show': '#882255'
};

export const STATUS_BACKGROUND_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#7ab8e0',
	'checked-in': '#5cc0a0',
	'group-one': '#e8b84d',
	'group-two': '#d4cf40',
	'special': '#d49abe',
	'alert': '#e08a65',
	'maintenance': '#a8b2be',
	'no-show': '#c49aaf'
};

export const STATUS_PATTERNS: Record<ReservationStatus, string> = {
	'reserved': 'none',
	'checked-in': 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 6px)',
	'group-one': 'radial-gradient(circle, rgba(0,0,0,0.10) 1px, transparent 1px)',
	'group-two': 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.07) 4px, rgba(0,0,0,0.07) 6px), repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.07) 4px, rgba(0,0,0,0.07) 6px)',
	'special': 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 6px)',
	'alert': 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(0,0,0,0.10) 3px, rgba(0,0,0,0.10) 5px)',
	'maintenance': 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 6px)',
	'no-show': 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 5px)'
};

export const STATUS_PATTERN_SIZES: Record<ReservationStatus, string> = {
	'reserved': 'auto',
	'checked-in': 'auto',
	'group-one': '8px 8px',
	'group-two': 'auto',
	'special': 'auto',
	'alert': 'auto',
	'maintenance': 'auto',
	'no-show': 'auto'
};

export const STATUS_ICONS: Record<ReservationStatus, string> = {
	'reserved': '\u{1F4CB}',
	'checked-in': '\u2705',
	'group-one': '\u{1F465}',
	'group-two': '\u{1F46A}',
	'special': '\u2B50',
	'alert': '\u26A0\uFE0F',
	'maintenance': '\u{1F527}',
	'no-show': '\u{274C}'
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
	'reserved': 'Reserved',
	'checked-in': 'Checked In',
	'group-one': 'Group One',
	'group-two': 'Group Two',
	'special': 'Special',
	'alert': 'Alert',
	'maintenance': 'Maintenance',
	'no-show': 'No-Show'
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

export function getStatusCellStyle(status: ReservationStatus): string {
	return `background-color: ${STATUS_BACKGROUND_COLORS[status]}; background-image: ${STATUS_PATTERNS[status]}; background-size: ${STATUS_PATTERN_SIZES[status]}; border-left: 3px solid ${STATUS_COLORS[status]};`;
}

export function getStatusSwatchStyle(status: ReservationStatus): string {
	return `background-color: ${STATUS_BACKGROUND_COLORS[status]}; background-image: ${STATUS_PATTERNS[status]}; background-size: ${STATUS_PATTERN_SIZES[status]}; border: 2px solid ${STATUS_COLORS[status]};`;
}
