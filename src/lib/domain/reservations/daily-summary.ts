import type { Reservation } from '$lib/domain/models';

export interface DailySummary {
	arrivals: number;
	departures: number;
	occupied: number;
	vacant: number;
	totalSites: number;
}

/**
 * Compute a daily operations summary for the given date.
 *
 * - arrivals: reservations whose startDate === today
 * - departures: reservations whose endDate === today
 * - occupied: distinct sites with an active reservation spanning today
 *   (startDate <= today < endDate, since endDate is exclusive)
 * - vacant: totalSites - occupied
 */
export function computeDailySummary(
	reservations: Reservation[],
	sites: string[],
	today: string
): DailySummary {
	let arrivals = 0;
	let departures = 0;
	const occupiedSites = new Set<string>();

	for (const reservation of reservations) {
		if (reservation.startDate === today) {
			arrivals += 1;
		}
		if (reservation.endDate === today) {
			departures += 1;
		}
		// A site is occupied on `today` if startDate <= today < endDate
		if (reservation.startDate <= today && today < reservation.endDate) {
			occupiedSites.add(reservation.parkingLocation);
		}
	}

	const totalSites = sites.length;
	const occupied = occupiedSites.size;

	return {
		arrivals,
		departures,
		occupied,
		vacant: totalSites - occupied,
		totalSites
	};
}
