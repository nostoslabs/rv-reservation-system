import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { getAppServices } from '$lib/app/composition';
import { getDefaultPersistedAppData } from '$lib/storage';
import type { AppState, MutationResult, PersistedAppData, ReservationFormValues } from '$lib/types';

function createRvReservationStore() {
	const internal = writable<AppState>({
		...getDefaultPersistedAppData(),
		hydrated: false
	});

	async function commit(next: AppState, persist = true): Promise<void> {
		if (persist) {
			const { repositories } = getAppServices();
			const savedAt = await repositories.appData.save({
				version: next.version,
				reservations: next.reservations,
				parkingLocations: next.parkingLocations,
				nextReservationIndex: next.nextReservationIndex,
				lastSavedAt: next.lastSavedAt
			});
			internal.set({
				...next,
				lastSavedAt: savedAt,
				hydrated: true
			});
		} else {
			internal.set(next);
		}
	}

	function getState(): AppState {
		return get(internal);
	}

	function getPersistedData(): PersistedAppData {
		const s = getState();
		return {
			version: s.version,
			reservations: s.reservations,
			parkingLocations: s.parkingLocations,
			nextReservationIndex: s.nextReservationIndex,
			lastSavedAt: s.lastSavedAt
		};
	}

	function hydrate(): void {
		if (!browser) return;
		const { repositories } = getAppServices();
		const persisted = repositories.appData.load();
		internal.set({ ...persisted, hydrated: true });
	}

	async function saveReservation(formInput: ReservationFormValues): Promise<MutationResult> {
		const { reservationUseCases } = getAppServices();
		const result = reservationUseCases.save(formInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		await commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	async function deleteReservation(index: number): Promise<MutationResult> {
		const { reservationUseCases } = getAppServices();
		const result = reservationUseCases.remove(index, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		await commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	async function addParkingLocation(nameInput: string): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.add(nameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		await commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	async function renameParkingLocation(oldName: string, newNameInput: string): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.rename(oldName, newNameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		await commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	async function deleteParkingLocation(name: string): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.remove(name, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		await commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	async function reorderParkingLocations(orderedNames: string[]): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.reorder(orderedNames, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		await commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	async function importData(data: PersistedAppData): Promise<void> {
		await commit({ ...data, hydrated: true }, true);
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		saveReservation,
		deleteReservation,
		addParkingLocation,
		renameParkingLocation,
		deleteParkingLocation,
		reorderParkingLocations,
		importData
	};
}

export const rvReservationStore = createRvReservationStore();
