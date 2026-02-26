import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import {
  buildFirstCellId,
  normalizeName,
  normalizePhoneNumber,
  normalizeReservationNotes,
  validateReservationForm
} from '$lib/reservations';
import { getDefaultPersistedAppData, loadPersistedAppData, savePersistedAppData } from '$lib/storage';
import type { AppState, MutationResult, Reservation, ReservationFormValues } from '$lib/types';

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

  function hydrate(): void {
    if (!browser) return;
    commit({ ...toRuntimeState(), hydrated: true }, false);
  }

  function forceSave(): void {
    const state = getState();
    commit({ ...state, hydrated: true }, true);
  }

  function saveReservation(formInput: ReservationFormValues): MutationResult {
    const state = getState();
    const form: ReservationFormValues = {
      ...formInput,
      name: normalizeName(formInput.name),
      phoneNumber: normalizePhoneNumber(formInput.phoneNumber ?? ''),
      notes: normalizeReservationNotes(formInput.notes ?? '')
    };

    const errors = validateReservationForm(form, {
      existingReservations: state.reservations,
      parkingLocations: state.parkingLocations
    });

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    const existing = typeof form.index === 'number'
      ? state.reservations.find((reservation) => reservation.index === form.index)
      : undefined;

    if (typeof form.index === 'number' && !existing) {
      return { ok: false, errors: ['Reservation not found.'] };
    }

    const index = existing?.index ?? state.nextReservationIndex;
    const nextReservation: Reservation = {
      index,
      firstCellId: buildFirstCellId(form.parkingLocation, form.startDate),
      name: form.name,
      phoneNumber: form.phoneNumber,
      notes: form.notes,
      startDate: form.startDate,
      endDate: form.endDate,
      parkingLocation: form.parkingLocation,
      color: form.color
    };

    const reservations = existing
      ? state.reservations.map((reservation) =>
          reservation.index === existing.index ? nextReservation : reservation
        )
      : [...state.reservations, nextReservation];

    commit(
      {
        ...state,
        reservations: sortReservations(reservations),
        nextReservationIndex: existing ? state.nextReservationIndex : state.nextReservationIndex + 1,
        hydrated: true
      },
      true
    );

    return { ok: true };
  }

  function deleteReservation(index: number): MutationResult {
    const state = getState();
    const exists = state.reservations.some((reservation) => reservation.index === index);
    if (!exists) {
      return { ok: false, errors: ['Reservation not found.'] };
    }

    commit(
      {
        ...state,
        reservations: state.reservations.filter((reservation) => reservation.index !== index),
        hydrated: true
      },
      true
    );

    return { ok: true };
  }

  function addParkingLocation(nameInput: string): MutationResult {
    const state = getState();
    const name = normalizeName(nameInput);
    if (!name) return { ok: false, errors: ['Location name is required.'] };
    if (state.parkingLocations.includes(name)) {
      return { ok: false, errors: ['Location already exists.'] };
    }

    commit(
      {
        ...state,
        parkingLocations: [...state.parkingLocations, name],
        hydrated: true
      },
      true
    );

    return { ok: true };
  }

  function renameParkingLocation(oldName: string, newNameInput: string): MutationResult {
    const state = getState();
    const newName = normalizeName(newNameInput);

    if (!state.parkingLocations.includes(oldName)) {
      return { ok: false, errors: ['Original location not found.'] };
    }

    if (!newName) {
      return { ok: false, errors: ['New location name is required.'] };
    }

    if (oldName !== newName && state.parkingLocations.includes(newName)) {
      return { ok: false, errors: ['Another location already uses that name.'] };
    }

    const parkingLocations = state.parkingLocations.map((location) =>
      location === oldName ? newName : location
    );

    const reservations = state.reservations.map((reservation) =>
      reservation.parkingLocation === oldName
        ? {
            ...reservation,
            parkingLocation: newName,
            firstCellId: buildFirstCellId(newName, reservation.startDate)
          }
        : reservation
    );

    commit(
      {
        ...state,
        parkingLocations,
        reservations: sortReservations(reservations),
        hydrated: true
      },
      true
    );

    return { ok: true };
  }

  function deleteParkingLocation(name: string): MutationResult {
    const state = getState();
    if (!state.parkingLocations.includes(name)) {
      return { ok: false, errors: ['Location not found.'] };
    }

    if (state.reservations.some((reservation) => reservation.parkingLocation === name)) {
      return {
        ok: false,
        errors: ['Cannot delete a location that still has reservations. Remove or move those reservations first.']
      };
    }

    commit(
      {
        ...state,
        parkingLocations: state.parkingLocations.filter((location) => location !== name),
        hydrated: true
      },
      true
    );

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
