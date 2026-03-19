import type { CustomerRepository } from '$lib/application/ports/customer';
import type { Customer } from '$lib/domain/customers';
import type { PersistedAppData } from '$lib/types';
import {
	resolveCustomerMerge,
	findDuplicateGroups,
	normalizeName,
	normalizePhoneNumber
} from '$lib/domain/customers';

export type MergeCustomersResult =
	| { ok: true; winner: Customer; mergedCount: number; reservationsRelinked: number; data: PersistedAppData }
	| { ok: false; errors: string[] };

export interface DeduplicateAllResult {
	groupsMerged: number;
	reservationsRelinked: number;
	data: PersistedAppData;
}

export interface MergeCustomersUseCases {
	merge(
		customerIds: string[],
		appData: PersistedAppData,
		overrides?: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes'>>
	): MergeCustomersResult;

	findDuplicates(): Customer[][];

	deduplicateAll(appData: PersistedAppData): DeduplicateAllResult;
}

export function createMergeCustomersUseCases(repo: CustomerRepository): MergeCustomersUseCases {
	function relinkReservations(
		appData: PersistedAppData,
		winnerId: string,
		loserIds: string[],
		loserCustomers: Customer[]
	): { data: PersistedAppData; count: number } {
		const loserIdSet = new Set(loserIds);
		let count = 0;

		// Build lookup of loser normalized name+phone for legacy matching
		const loserKeys = new Set(
			loserCustomers.map(
				(c) => normalizeName(c.name).toLowerCase() + '|' + normalizePhoneNumber(c.phone).toLowerCase()
			)
		);

		const reservations = appData.reservations.map((r) => {
			// Direct customerId match
			if (r.customerId && loserIdSet.has(r.customerId)) {
				count++;
				return { ...r, customerId: winnerId };
			}

			// Legacy: no customerId, match by normalized name+phone to a loser
			if (!r.customerId) {
				const rKey =
					normalizeName(r.name).toLowerCase() + '|' + normalizePhoneNumber(r.phoneNumber).toLowerCase();
				if (loserKeys.has(rKey)) {
					count++;
					return { ...r, customerId: winnerId };
				}
			}

			return r;
		});

		return {
			data: { ...appData, reservations },
			count
		};
	}

	return {
		merge(customerIds, appData, overrides) {
			if (customerIds.length < 2) {
				return { ok: false, errors: ['At least 2 customers are required to merge.'] };
			}

			const customers: Customer[] = [];
			for (const id of customerIds) {
				const c = repo.getById(id);
				if (!c) {
					return { ok: false, errors: [`Customer not found: ${id}`] };
				}
				customers.push(c);
			}

			const now = new Date().toISOString();
			const resolution = resolveCustomerMerge(customers, now);

			// Apply overrides
			if (overrides) {
				if (overrides.name !== undefined) resolution.winner.name = overrides.name;
				if (overrides.phone !== undefined) resolution.winner.phone = overrides.phone;
				if (overrides.email !== undefined) resolution.winner.email = overrides.email;
				if (overrides.notes !== undefined) resolution.winner.notes = overrides.notes;
			}

			// Persist winner
			repo.save(resolution.winner);

			// Remove losers
			const loserCustomers = customers.filter((c) => c.id !== resolution.winner.id);
			for (const loserId of resolution.loserIds) {
				repo.remove(loserId);
			}

			// Re-link reservations
			const { data, count } = relinkReservations(
				appData,
				resolution.winner.id,
				resolution.loserIds,
				loserCustomers
			);

			return {
				ok: true,
				winner: resolution.winner,
				mergedCount: customers.length,
				reservationsRelinked: count,
				data
			};
		},

		findDuplicates() {
			return findDuplicateGroups(repo.getAll());
		},

		deduplicateAll(appData) {
			const groups = findDuplicateGroups(repo.getAll());
			if (groups.length === 0) {
				return { groupsMerged: 0, reservationsRelinked: 0, data: appData };
			}

			// Build a single loser→winner mapping across all groups
			const loserIdToWinner = new Map<string, string>();
			const loserNamePhoneKeys = new Map<string, string>();

			for (const group of groups) {
				const now = new Date().toISOString();
				const resolution = resolveCustomerMerge(group, now);

				repo.save(resolution.winner);
				const loserCustomers = group.filter((c) => c.id !== resolution.winner.id);
				for (const loserId of resolution.loserIds) {
					repo.remove(loserId);
					loserIdToWinner.set(loserId, resolution.winner.id);
				}
				for (const loser of loserCustomers) {
					const key = normalizeName(loser.name).toLowerCase() + '|' + normalizePhoneNumber(loser.phone).toLowerCase();
					loserNamePhoneKeys.set(key, resolution.winner.id);
				}
			}

			// Single pass over reservations to re-link
			let totalReservationsRelinked = 0;
			const reservations = appData.reservations.map((r) => {
				if (r.customerId && loserIdToWinner.has(r.customerId)) {
					totalReservationsRelinked++;
					return { ...r, customerId: loserIdToWinner.get(r.customerId)! };
				}
				if (!r.customerId) {
					const rKey = normalizeName(r.name).toLowerCase() + '|' + normalizePhoneNumber(r.phoneNumber).toLowerCase();
					const winnerId = loserNamePhoneKeys.get(rKey);
					if (winnerId) {
						totalReservationsRelinked++;
						return { ...r, customerId: winnerId };
					}
				}
				return r;
			});

			return {
				groupsMerged: groups.length,
				reservationsRelinked: totalReservationsRelinked,
				data: { ...appData, reservations }
			};
		}
	};
}
