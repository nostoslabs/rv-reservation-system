import type { AppDataRepository } from '$lib/application/ports';
import type { MutationResult, PersistedAppData, Reservation } from '$lib/domain/models';
import { buildFirstCellId, normalizeName } from '$lib/domain/reservations';

function sortReservations(reservations: Reservation[]): Reservation[] {
	return [...reservations].sort((a, b) => {
		if (a.parkingLocation !== b.parkingLocation) {
			return a.parkingLocation.localeCompare(b.parkingLocation);
		}
		if (a.startDate !== b.startDate) {
			return a.startDate.localeCompare(b.startDate);
		}
		return a.index - b.index;
	});
}

export interface ParkingLocationUseCases {
	add(nameInput: string, currentData: PersistedAppData): MutationResult & { data?: PersistedAppData };
	rename(oldName: string, newNameInput: string, currentData: PersistedAppData): MutationResult & { data?: PersistedAppData };
	remove(name: string, currentData: PersistedAppData): MutationResult & { data?: PersistedAppData };
	reorder(orderedNames: string[], currentData: PersistedAppData): MutationResult & { data?: PersistedAppData };
}

export function createParkingLocationUseCases(_repo: AppDataRepository): ParkingLocationUseCases {
	return {
		add(nameInput: string, currentData: PersistedAppData) {
			const name = normalizeName(nameInput);
			if (!name) return { ok: false as const, errors: ['Location name is required.'] };
			if (currentData.parkingLocations.includes(name)) {
				return { ok: false as const, errors: ['Location already exists.'] };
			}

			const data: PersistedAppData = {
				...currentData,
				parkingLocations: [...currentData.parkingLocations, name]
			};

			return { ok: true as const, data };
		},

		rename(oldName: string, newNameInput: string, currentData: PersistedAppData) {
			const newName = normalizeName(newNameInput);

			if (!currentData.parkingLocations.includes(oldName)) {
				return { ok: false as const, errors: ['Original location not found.'] };
			}

			if (!newName) {
				return { ok: false as const, errors: ['New location name is required.'] };
			}

			if (oldName !== newName && currentData.parkingLocations.includes(newName)) {
				return { ok: false as const, errors: ['Another location already uses that name.'] };
			}

			const parkingLocations = currentData.parkingLocations.map((loc) =>
				loc === oldName ? newName : loc
			);

			const reservations = currentData.reservations.map((r) =>
				r.parkingLocation === oldName
					? {
							...r,
							parkingLocation: newName,
							firstCellId: buildFirstCellId(newName, r.startDate)
						}
					: r
			);

			const data: PersistedAppData = {
				...currentData,
				parkingLocations,
				reservations: sortReservations(reservations)
			};

			return { ok: true as const, data };
		},

		remove(name: string, currentData: PersistedAppData) {
			if (!currentData.parkingLocations.includes(name)) {
				return { ok: false as const, errors: ['Location not found.'] };
			}

			if (currentData.reservations.some((r) => r.parkingLocation === name)) {
				return {
					ok: false as const,
					errors: [
						'Cannot delete a location that still has reservations. Remove or move those reservations first.'
					]
				};
			}

			const data: PersistedAppData = {
				...currentData,
				parkingLocations: currentData.parkingLocations.filter((loc) => loc !== name)
			};

			return { ok: true as const, data };
		},

		reorder(orderedNames: string[], currentData: PersistedAppData) {
			if (orderedNames.length !== currentData.parkingLocations.length) {
				return { ok: false as const, errors: ['Location count mismatch.'] };
			}

			const currentSet = new Set(currentData.parkingLocations);
			const newSet = new Set(orderedNames);
			if (currentSet.size !== newSet.size || [...currentSet].some((n) => !newSet.has(n))) {
				return { ok: false as const, errors: ['Reordered list must contain the same locations.'] };
			}

			const data: PersistedAppData = {
				...currentData,
				parkingLocations: orderedNames
			};

			return { ok: true as const, data };
		}
	};
}
