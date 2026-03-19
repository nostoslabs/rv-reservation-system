import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { getAppServices } from '$lib/app/composition';
import type { AppState, MutationResult, PersistedAppData, ReservationFormValues } from '$lib/types';

function toRuntimeState(): AppState {
	const { repositories } = getAppServices();
	const persisted = browser ? repositories.appData.load() : repositories.appData.getDefaultData();
	return {
		...persisted,
		hydrated: true
	};
}

function createRvReservationStore() {
	const internal = writable<AppState>(toRuntimeState());

	function commit(next: AppState, persist = true): void {
		let finalState = next;

		if (persist) {
			const { repositories } = getAppServices();
			const savedAt = repositories.appData.save({
				version: next.version,
				reservations: next.reservations,
				parkingLocations: next.parkingLocations,
				nextReservationIndex: next.nextReservationIndex,
				lastSavedAt: next.lastSavedAt
			});
			finalState = {
				...next,
				lastSavedAt: savedAt,
				hydrated: true
			};
		}

		internal.set(finalState);
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
		commit({ ...toRuntimeState(), hydrated: true }, false);
	}

	function forceSave(): void {
		const state = getState();
		commit({ ...state, hydrated: true }, true);
	}

	function saveReservation(formInput: ReservationFormValues): MutationResult {
		const { reservationUseCases } = getAppServices();
		const result = reservationUseCases.save(formInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function deleteReservation(index: number): MutationResult {
		const { reservationUseCases } = getAppServices();
		const result = reservationUseCases.remove(index, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function addParkingLocation(nameInput: string): MutationResult {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.add(nameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function renameParkingLocation(oldName: string, newNameInput: string): MutationResult {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.rename(oldName, newNameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function deleteParkingLocation(name: string): MutationResult {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.remove(name, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function reorderParkingLocations(orderedNames: string[]): MutationResult {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.reorder(orderedNames, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function importData(data: PersistedAppData): void {
		commit({ ...data, hydrated: true }, true);
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		forceSave,
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
