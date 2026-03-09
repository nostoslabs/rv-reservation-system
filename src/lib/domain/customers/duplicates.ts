import type { Customer } from './types';
import { normalizeName, normalizePhoneNumber } from './normalization';

/**
 * Find a duplicate customer by exact normalized name AND phone match.
 * Both name and phone must match to be considered a duplicate.
 * Returns null if no match or if phone is empty (can't match on name alone).
 */
export function findDuplicateCustomer(
	customers: readonly Customer[],
	name: string,
	phone: string
): Customer | null {
	const normalizedName = normalizeName(name).toLowerCase();
	const normalizedPhone = normalizePhoneNumber(phone).toLowerCase();

	if (!normalizedName) return null;
	if (!normalizedPhone) return null;

	for (const customer of customers) {
		const customerName = normalizeName(customer.name).toLowerCase();
		const customerPhone = normalizePhoneNumber(customer.phone).toLowerCase();

		if (customerName === normalizedName && customerPhone === normalizedPhone) {
			return customer;
		}
	}

	return null;
}
