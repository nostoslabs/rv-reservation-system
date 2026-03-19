import type { AppDataRepository } from '$lib/application/ports';
import type { MutationResult, PersistedAppData, Reservation, ReservationFormValues } from '$lib/domain/models';
import {
	buildFirstCellId,
	normalizeName,
	normalizePhoneNumber,
	normalizeReservationNotes,
	validateReservationForm
} from '$lib/domain/reservations';

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

export interface ReservationUseCases {
	save(formInput: ReservationFormValues, currentData: PersistedAppData): MutationResult & { data?: PersistedAppData };
	remove(index: number, currentData: PersistedAppData): MutationResult & { data?: PersistedAppData };
}

export function createReservationUseCases(_repo: AppDataRepository): ReservationUseCases {
	return {
		save(formInput: ReservationFormValues, currentData: PersistedAppData) {
			const form: ReservationFormValues = {
				...formInput,
				name: normalizeName(formInput.name),
				phoneNumber: normalizePhoneNumber(formInput.phoneNumber ?? ''),
				notes: normalizeReservationNotes(formInput.notes ?? '')
			};

			const errors = validateReservationForm(form, {
				existingReservations: currentData.reservations,
				parkingLocations: currentData.parkingLocations
			});

			if (errors.length > 0) {
				return { ok: false as const, errors };
			}

			const existing =
				typeof form.index === 'number'
					? currentData.reservations.find((r) => r.index === form.index)
					: undefined;

			if (typeof form.index === 'number' && !existing) {
				return { ok: false as const, errors: ['Reservation not found.'] };
			}

			const index = existing?.index ?? currentData.nextReservationIndex;
			const nextReservation: Reservation = {
				index,
				firstCellId: buildFirstCellId(form.parkingLocation, form.startDate),
				name: form.name,
				phoneNumber: form.phoneNumber,
				notes: form.notes,
				startDate: form.startDate,
				endDate: form.endDate,
				parkingLocation: form.parkingLocation,
				color: form.color,
				status: form.status,
				customerId: form.customerId
			};

			const reservations = existing
				? currentData.reservations.map((r) =>
						r.index === existing.index ? nextReservation : r
					)
				: [...currentData.reservations, nextReservation];

			const data: PersistedAppData = {
				...currentData,
				reservations: sortReservations(reservations),
				nextReservationIndex: existing
					? currentData.nextReservationIndex
					: currentData.nextReservationIndex + 1
			};

			return { ok: true as const, data };
		},

		remove(index: number, currentData: PersistedAppData) {
			const exists = currentData.reservations.some((r) => r.index === index);
			if (!exists) {
				return { ok: false as const, errors: ['Reservation not found.'] };
			}

			const data: PersistedAppData = {
				...currentData,
				reservations: currentData.reservations.filter((r) => r.index !== index)
			};

			return { ok: true as const, data };
		}
	};
}
