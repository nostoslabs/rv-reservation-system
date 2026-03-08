import {
	RESERVATION_STATUSES,
	type ReservationStatus
} from '$lib/types';

/** Map each status to a display color (hex). */
export const STATUS_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#3b82f6',
	'checked-in': '#22c55e',
	'due-out': '#f59e0b',
	'maintenance': '#6b7280'
};

/** Map each status to a light background tint for grid cells. */
export const STATUS_BG_COLORS: Record<ReservationStatus, string> = {
	'reserved': '#dbeafe',
	'checked-in': '#dcfce7',
	'due-out': '#fef3c7',
	'maintenance': '#f3f4f6'
};

/** Human-readable label for each status. */
export const STATUS_LABELS: Record<ReservationStatus, string> = {
	'reserved': 'Reserved',
	'checked-in': 'Checked In',
	'due-out': 'Due Out',
	'maintenance': 'Maintenance'
};

/** Default status for newly created reservations. */
export const DEFAULT_RESERVATION_STATUS: ReservationStatus = 'reserved';

/** Type guard for ReservationStatus values. */
export function isReservationStatus(value: string): value is ReservationStatus {
	return (RESERVATION_STATUSES as readonly string[]).includes(value);
}

/** Get the display color for a given status. */
export function getStatusColor(status: ReservationStatus): string {
	return STATUS_COLORS[status];
}

/** Get the background color for a given status (used in grid cells). */
export function getStatusBgColor(status: ReservationStatus): string {
	return STATUS_BG_COLORS[status];
}

/** Get the human-readable label for a given status. */
export function getStatusLabel(status: ReservationStatus): string {
	return STATUS_LABELS[status];
}
