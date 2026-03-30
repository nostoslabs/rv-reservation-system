import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { flushPendingWrites, getAppServices } from '$lib/app/composition';
import type { AppState, MutationResult, PersistedAppData, ReservationFormValues } from '$lib/domain/models';

const APP_DATA_PERSISTENCE_ERROR = 'Unable to save changes to disk.';

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

	function setHydratedState(data: PersistedAppData): void {
		internal.set({
			...data,
			hydrated: true
		});
	}

	async function persist(data: PersistedAppData): Promise<MutationResult> {
		const { repositories } = getAppServices();

		try {
			repositories.appData.save(data);
			await flushPendingWrites();
			setHydratedState(repositories.appData.load());
			return { ok: true };
		} catch (error) {
			console.error('Failed to persist reservation data:', error);
			return { ok: false, errors: [APP_DATA_PERSISTENCE_ERROR] };
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
		setHydratedState(toRuntimeState());
	}

	async function saveReservation(formInput: ReservationFormValues): Promise<MutationResult> {
		const { reservationUseCases } = getAppServices();
		const result = reservationUseCases.save(formInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		return persist(result.data!);
	}

	async function deleteReservation(index: number): Promise<MutationResult> {
		const { reservationUseCases } = getAppServices();
		const result = reservationUseCases.remove(index, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		return persist(result.data!);
	}

	async function addParkingLocation(nameInput: string): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.add(nameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		return persist(result.data!);
	}

	async function renameParkingLocation(oldName: string, newNameInput: string): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.rename(oldName, newNameInput, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		return persist(result.data!);
	}

	async function deleteParkingLocation(name: string): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.remove(name, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		return persist(result.data!);
	}

	async function reorderParkingLocations(orderedNames: string[]): Promise<MutationResult> {
		const { parkingLocationUseCases } = getAppServices();
		const result = parkingLocationUseCases.reorder(orderedNames, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		return persist(result.data!);
	}

	async function moveReservation(index: number, daysDelta: number, newSite?: string): Promise<MutationResult> {
		const { reservationUseCases } = getAppServices();
		const result = reservationUseCases.move(index, daysDelta, newSite, getPersistedData());
		if (!result.ok) {
			return { ok: false, errors: result.errors };
		}

		return persist(result.data!);
	}

	async function importData(data: PersistedAppData): Promise<MutationResult> {
		return persist(data);
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		saveReservation,
		deleteReservation,
		moveReservation,
		addParkingLocation,
		renameParkingLocation,
		deleteParkingLocation,
		reorderParkingLocations,
		importData
	};
}

export const rvReservationStore = createRvReservationStore();
