import type { Customer, CustomerSearchResult } from './types';

/**
 * Search customers by query, matching against name, phone, and email.
 * Returns results sorted by relevance: exact match first, then startsWith, then contains.
 * Within the same relevance tier, results are sorted alphabetically by name.
 */
export function searchCustomers(
	customers: readonly Customer[],
	query: string
): CustomerSearchResult[] {
	const trimmed = query.trim();
	if (trimmed === '') return [];

	const lowerQuery = trimmed.toLowerCase();
	const results: CustomerSearchResult[] = [];

	for (const customer of customers) {
		const lowerName = customer.name.toLowerCase();
		const lowerPhone = customer.phone.toLowerCase();
		const lowerEmail = customer.email.toLowerCase();

		let bestScore = Infinity;

		for (const field of [lowerName, lowerPhone, lowerEmail]) {
			if (field === lowerQuery) {
				bestScore = Math.min(bestScore, 0);
			} else if (field.startsWith(lowerQuery)) {
				bestScore = Math.min(bestScore, 1);
			} else if (field.includes(lowerQuery)) {
				bestScore = Math.min(bestScore, 2);
			}
		}

		if (bestScore !== Infinity) {
			results.push({ customer, score: bestScore });
		}
	}

	results.sort((a, b) => {
		if (a.score !== b.score) return a.score - b.score;
		return a.customer.name.localeCompare(b.customer.name);
	});

	return results;
}
