import { get } from 'svelte/store';
import { rvReservationStore } from '$lib/state';
import { customerStore } from '$lib/customer-state';
import { pushUndo } from './undo';
import type { MutationResult, ReservationFormValues } from '$lib/types';
import type { CustomerFormValues } from '$lib/domain/customers';

export async function deleteReservationWithUndo(index: number): Promise<MutationResult> {
	const state = get(rvReservationStore);
	const reservation = state.reservations.find((r) => r.index === index);
	if (!reservation) {
		return { ok: false, errors: ['Reservation not found.'] };
	}

	const savedForm: ReservationFormValues = {
		index: reservation.index,
		name: reservation.name,
		rvType: reservation.rvType,
		phoneNumber: reservation.phoneNumber,
		notes: reservation.notes,
		startDate: reservation.startDate,
		endDate: reservation.endDate,
		parkingLocation: reservation.parkingLocation,
		color: reservation.color,
		status: reservation.status,
		customerId: reservation.customerId
	};

	const result = await rvReservationStore.deleteReservation(index);
	if (result.ok) {
		pushUndo(`Delete "${reservation.name}"`, async () => {
			await rvReservationStore.saveReservation(savedForm);
		});
	}
	return result;
}

export async function saveReservationWithUndo(formInput: ReservationFormValues): Promise<MutationResult> {
	// Only register undo for edits, not creates
	if (typeof formInput.index !== 'number') {
		return rvReservationStore.saveReservation(formInput);
	}

	const state = get(rvReservationStore);
	const existing = state.reservations.find((r) => r.index === formInput.index);
	if (!existing) {
		return rvReservationStore.saveReservation(formInput);
	}

	const previousForm: ReservationFormValues = {
		index: existing.index,
		name: existing.name,
		rvType: existing.rvType,
		phoneNumber: existing.phoneNumber,
		notes: existing.notes,
		startDate: existing.startDate,
		endDate: existing.endDate,
		parkingLocation: existing.parkingLocation,
		color: existing.color,
		status: existing.status,
		customerId: existing.customerId
	};

	const result = await rvReservationStore.saveReservation(formInput);
	if (result.ok) {
		pushUndo(`Edit "${existing.name}"`, async () => {
			await rvReservationStore.saveReservation(previousForm);
		});
	}
	return result;
}

export async function moveReservationWithUndo(
	index: number,
	daysDelta: number,
	newSite?: string
): Promise<MutationResult> {
	const state = get(rvReservationStore);
	const reservation = state.reservations.find((r) => r.index === index);
	if (!reservation) {
		return { ok: false, errors: ['Reservation not found.'] };
	}

	const originalSite = reservation.parkingLocation;
	const result = await rvReservationStore.moveReservation(index, daysDelta, newSite);
	if (result.ok) {
		const reverseSite = newSite ? originalSite : undefined;
		pushUndo(`Move "${reservation.name}"`, async () => {
			await rvReservationStore.moveReservation(index, -daysDelta, reverseSite);
		});
	}
	return result;
}

export async function deleteCustomerWithUndo(id: string): Promise<{ ok: boolean; errors?: string[] }> {
	const customer = customerStore.getById(id);
	if (!customer) {
		return { ok: false, errors: ['Customer not found.'] };
	}

	const result = await customerStore.remove(id);
	if (result.ok) {
		const savedCustomer = { ...customer };
		pushUndo(`Delete "${customer.name}"`, async () => {
			await customerStore.create({
				name: savedCustomer.name,
				phone: savedCustomer.phone,
				rvType: savedCustomer.rvType,
				email: savedCustomer.email,
				notes: savedCustomer.notes
			});
		});
	}
	return result;
}

export async function updateCustomerWithUndo(form: CustomerFormValues): Promise<{ ok: boolean; errors?: string[] }> {
	if (!form.id) {
		return customerStore.update(form);
	}

	const existing = customerStore.getById(form.id);
	if (!existing) {
		return customerStore.update(form);
	}

	const previousForm: CustomerFormValues = {
		id: existing.id,
		name: existing.name,
		phone: existing.phone,
		rvType: existing.rvType,
		email: existing.email,
		notes: existing.notes
	};

	const result = await customerStore.update(form);
	if (result.ok) {
		pushUndo(`Edit "${existing.name}"`, async () => {
			await customerStore.update(previousForm);
		});
	}
	return result;
}
