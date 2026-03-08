import type { Reservation } from '$lib/types';

export interface SearchResult {
	reservation: Reservation;
	/** Lower score = better match. Exact matches get 0, startsWith gets 1, contains gets 2. */
	score: number;
}

/**
 * Filter reservations by a search query, matching against guest name and parking location.
 * Returns results sorted by relevance: exact match first, then startsWith, then contains.
 * Within the same relevance tier, results are sorted alphabetically by guest name.
 *
 * This is a pure domain function with no side effects.
 */
export function filterReservations(
	reservations: readonly Reservation[],
	query: string
): SearchResult[] {
	const trimmed = query.trim();
	if (trimmed === '') return [];

	const lowerQuery = trimmed.toLowerCase();
	const results: SearchResult[] = [];

	for (const reservation of reservations) {
		const lowerName = reservation.name.toLowerCase();
		const lowerLocation = reservation.parkingLocation.toLowerCase();

		let bestScore = Infinity;

		// Check guest name
		if (lowerName === lowerQuery) {
			bestScore = Math.min(bestScore, 0);
		} else if (lowerName.startsWith(lowerQuery)) {
			bestScore = Math.min(bestScore, 1);
		} else if (lowerName.includes(lowerQuery)) {
			bestScore = Math.min(bestScore, 2);
		}

		// Check parking location
		if (lowerLocation === lowerQuery) {
			bestScore = Math.min(bestScore, 0);
		} else if (lowerLocation.startsWith(lowerQuery)) {
			bestScore = Math.min(bestScore, 1);
		} else if (lowerLocation.includes(lowerQuery)) {
			bestScore = Math.min(bestScore, 2);
		}

		if (bestScore !== Infinity) {
			results.push({ reservation, score: bestScore });
		}
	}

	results.sort((a, b) => {
		if (a.score !== b.score) return a.score - b.score;
		return a.reservation.name.localeCompare(b.reservation.name);
	});

	return results;
}
