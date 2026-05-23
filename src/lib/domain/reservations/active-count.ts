import { compareIsoDates } from '$lib/date';
import type { Reservation } from '$lib/domain/models';

export function countCurrentAndFutureReservations(
	reservations: Reservation[],
	todayIso: string
): number {
	return reservations.filter((reservation) => compareIsoDates(reservation.endDate, todayIso) >= 0)
		.length;
}
