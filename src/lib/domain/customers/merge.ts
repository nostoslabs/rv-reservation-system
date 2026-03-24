import type { Customer } from './types';
import { MAX_CUSTOMER_NOTES_LENGTH } from './types';
import { normalizeName, normalizePhoneNumber } from './normalization';

export interface MergeResolution {
	winner: Customer;
	loserIds: string[];
}

/**
 * Pure, deterministic merge of 2+ customers into a single winner.
 * - id: most recently updated customer's ID
 * - name: longest non-empty (tie-break: most recently updated)
 * - phone: first non-empty from most-recent-first sorted list
 * - email: same as phone
 * - notes: concatenate all unique non-empty notes, truncate to MAX_CUSTOMER_NOTES_LENGTH
 * - createdAt: earliest
 * - updatedAt: `now` parameter
 */
export function resolveCustomerMerge(
	customers: readonly Customer[],
	now: string
): MergeResolution {
	if (customers.length < 2) {
		throw new Error('At least 2 customers are required to merge');
	}

	// Sort by updatedAt descending for tie-breaking (most recent first)
	const sorted = [...customers].sort(
		(a, b) => b.updatedAt.localeCompare(a.updatedAt)
	);

	const winnerId = sorted[0].id;

	// Name: longest non-empty, tie-break most recently updated
	const name = pickBestString(sorted, (c) => c.name);

	// Phone: first non-empty from most-recent-first
	const phone = pickFirstNonEmpty(sorted, (c) => c.phone);

	// RV Type: first non-empty from most-recent-first
	const rvType = pickFirstNonEmpty(sorted, (c) => c.rvType);

	// Email: first non-empty from most-recent-first
	const email = pickFirstNonEmpty(sorted, (c) => c.email);

	// Notes: concatenate unique non-empty
	const uniqueNotes = new Set<string>();
	const notesList: string[] = [];
	for (const c of sorted) {
		const trimmed = c.notes.trim();
		if (trimmed && !uniqueNotes.has(trimmed)) {
			uniqueNotes.add(trimmed);
			notesList.push(trimmed);
		}
	}
	const notes = notesList.join('\n').slice(0, MAX_CUSTOMER_NOTES_LENGTH);

	// createdAt: earliest
	const createdAt = sorted.reduce(
		(earliest, c) => (c.createdAt < earliest ? c.createdAt : earliest),
		sorted[0].createdAt
	);

	const winner: Customer = {
		id: winnerId,
		name,
		phone,
		rvType,
		email,
		notes,
		createdAt,
		updatedAt: now
	};

	const loserIds = customers.filter((c) => c.id !== winnerId).map((c) => c.id);

	return { winner, loserIds };
}

function pickBestString(
	sorted: Customer[],
	accessor: (c: Customer) => string
): string {
	let best = '';
	let bestLength = 0;
	let bestIndex = sorted.length;

	for (let i = 0; i < sorted.length; i++) {
		const val = accessor(sorted[i]).trim();
		if (!val) continue;
		if (val.length > bestLength || (val.length === bestLength && i < bestIndex)) {
			best = val;
			bestLength = val.length;
			bestIndex = i;
		}
	}

	return best;
}

function pickFirstNonEmpty(
	sorted: Customer[],
	accessor: (c: Customer) => string
): string {
	for (const c of sorted) {
		const val = accessor(c).trim();
		if (val) return val;
	}
	return '';
}

/**
 * Group customers that are duplicates by normalized name + phone.
 * When both phones are empty, groups by name alone.
 * Returns only groups with 2+ customers.
 */
export function findDuplicateGroups(customers: readonly Customer[]): Customer[][] {
	const groups = new Map<string, Customer[]>();

	for (const customer of customers) {
		const name = normalizeName(customer.name).toLowerCase();
		if (!name) continue;
		const phone = normalizePhoneNumber(customer.phone).toLowerCase();
		const key = name + '|' + phone;

		const group = groups.get(key);
		if (group) {
			group.push(customer);
		} else {
			groups.set(key, [customer]);
		}
	}

	return Array.from(groups.values()).filter((g) => g.length >= 2);
}
