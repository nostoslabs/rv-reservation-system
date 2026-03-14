import {
	RESERVATION_STATUSES,
	type ReservationStatus
} from '$lib/domain/models';

export const DEFAULT_RESERVATION_STATUS: ReservationStatus = 'reserved';

export const STATUS_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#3b82f6',
	'checked-in': '#22c55e',
	'group-one': '#8b5cf6',
	'group-two': '#f59e0b',
	'special': '#ec4899',
	'alert': '#ef4444',
	'maintenance': '#6b7280'
};

export const STATUS_BACKGROUND_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#dbeafe',
	'checked-in': '#dcfce7',
	'group-one': '#ede9fe',
	'group-two': '#fef3c7',
	'special': '#fce7f3',
	'alert': '#fee2e2',
	'maintenance': '#f3f4f6'
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

export function getStatusLabel(status: ReservationStatus): string {
	return STATUS_LABELS[status];
}
