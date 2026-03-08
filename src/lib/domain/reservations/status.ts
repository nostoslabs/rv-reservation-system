import {
	RESERVATION_STATUSES,
	type ReservationStatus
} from '$lib/types';

export const DEFAULT_RESERVATION_STATUS: ReservationStatus = 'reserved';

export const STATUS_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#3b82f6',
	'checked-in': '#22c55e',
	'due-out': '#f59e0b',
	'maintenance': '#6b7280'
};

export const STATUS_BACKGROUND_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#dbeafe',
	'checked-in': '#dcfce7',
	'due-out': '#fef3c7',
	'maintenance': '#f3f4f6'
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
	'reserved': 'Reserved',
	'checked-in': 'Checked In',
	'due-out': 'Due Out',
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
