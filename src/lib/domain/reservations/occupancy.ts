import { enumerateDates } from '$lib/date';
import type { Reservation } from '$lib/domain/models';

export function buildCellId(parkingLocation: string, isoDate: string): string {
	return `${encodeURIComponent(parkingLocation)}::${isoDate}`;
}

export function buildFirstCellId(parkingLocation: string, startDate: string): string {
	return buildCellId(parkingLocation, startDate);
}

export function buildOccupancyMap(reservations: Reservation[]): Map<string, Reservation> {
	const occupancy = new Map<string, Reservation>();

	for (const reservation of reservations) {
		for (const date of enumerateDates(reservation.startDate, reservation.endDate)) {
			occupancy.set(buildCellId(reservation.parkingLocation, date), reservation);
		}
	}

	return occupancy;
}
