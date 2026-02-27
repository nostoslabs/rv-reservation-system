import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { createParkingLocationUseCases } from '$lib/application/use-cases';
import { createReservationUseCases } from '$lib/application/use-cases';
import type { AppState, MutationResult, PersistedAppData, ReservationFormValues } from '$lib/types';
import { getDefaultPersistedAppData, loadPersistedAppData, savePersistedAppData } from '$lib/storage';

// Temporary: use-cases are instantiated with a lightweight shim repo.
// This will be replaced by the composition root in Issue 1.4.
const shimRepo = {
	getDefaultData: getDefaultPersistedAppData,
	load: loadPersistedAppData,
	save: savePersistedAppData,
	clear() {
		/* no-op for now */
	}
};

const reservationUseCases = createReservationUseCases(shimRepo);
const parkingLocationUseCases = createParkingLocationUseCases(shimRepo);

function toRuntimeState(): AppState {
	const persisted = browser ? loadPersistedAppData() : getDefaultPersistedAppData();
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
			const savedAt = savePersistedAppData({
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
		const result = reservationUseCases.save(formInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function deleteReservation(index: number): MutationResult {
		const result = reservationUseCases.remove(index, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function addParkingLocation(nameInput: string): MutationResult {
		const result = parkingLocationUseCases.add(nameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function renameParkingLocation(oldName: string, newNameInput: string): MutationResult {
		const result = parkingLocationUseCases.rename(oldName, newNameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	function deleteParkingLocation(name: string): MutationResult {
		const result = parkingLocationUseCases.remove(name, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		commit({ ...result.data!, hydrated: true }, true);
		return { ok: true };
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		forceSave,
		saveReservation,
		deleteReservation,
		addParkingLocation,
		renameParkingLocation,
		deleteParkingLocation
	};
}

export const rvReservationStore = createRvReservationStore();
