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
	'reserved': '#d4eaf7',
	'checked-in': '#ccefe6',
	'group-one': '#faecd0',
	'group-two': '#fcf9d6',
	'special': '#f5e0ed',
	'alert': '#f8ddd0',
	'maintenance': '#daeef9'
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
