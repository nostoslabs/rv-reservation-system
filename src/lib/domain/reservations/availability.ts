import { isIsoDateString, compareIsoDates } from '$lib/date';
import type { Reservation } from '$lib/domain/models';
import { checkOverlap } from './validation';

export interface LocationAvailability {
	location: string;
	isAvailable: boolean;
	conflictingReservationIndex?: number;
}

/**
 * For each parking location, determine whether it is free for the given date range.
 * Returns all locations as available when the date range is missing or invalid,
 * matching the modal's "no decoration until both dates are valid" behavior.
 */
export function computeLocationAvailability(
	startDate: string,
	endDate: string,
	parkingLocations: string[],
	existingReservations: Reservation[],
	excludeReservationIndex?: number
): LocationAvailability[] {
	const rangeIsValid =
		isIsoDateString(startDate) &&
		isIsoDateString(endDate) &&
		compareIsoDates(startDate, endDate) < 0;

	if (!rangeIsValid) {
		return parkingLocations.map((location) => ({ location, isAvailable: true }));
	}

	return parkingLocations.map((location) => {
		for (const reservation of existingReservations) {
			if (typeof excludeReservationIndex === 'number' && reservation.index === excludeReservationIndex) {
				continue;
			}
			if (reservation.parkingLocation !== location) {
				continue;
			}
			if (checkOverlap(startDate, endDate, reservation.startDate, reservation.endDate)) {
				return {
					location,
					isAvailable: false,
					conflictingReservationIndex: reservation.index
				};
			}
		}
		return { location, isAvailable: true };
	});
}
