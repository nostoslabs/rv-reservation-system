import type { Customer } from './types';
import { normalizeName, normalizePhoneNumber } from './normalization';

/**
 * Find a duplicate customer by exact normalized name AND phone match.
 * When both the input phone and a candidate's phone are empty, matches on name alone.
 * When phones are present, both name and phone must match.
 */
export function findDuplicateCustomer(
	customers: readonly Customer[],
	name: string,
	phone: string
): Customer | null {
	const normalizedName = normalizeName(name).toLowerCase();
	const normalizedPhone = normalizePhoneNumber(phone).toLowerCase();

	if (!normalizedName) return null;

	for (const customer of customers) {
		const customerName = normalizeName(customer.name).toLowerCase();
		if (customerName !== normalizedName) continue;

		const customerPhone = normalizePhoneNumber(customer.phone).toLowerCase();

		// Both phones empty → name-only match
		if (!normalizedPhone && !customerPhone) {
			return customer;
		}

		// Both phones present and equal → name+phone match
		if (normalizedPhone && customerPhone && customerPhone === normalizedPhone) {
			return customer;
		}
	}

	return null;
}
