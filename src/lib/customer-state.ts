import { writable, get } from 'svelte/store';
import { getAppServices } from '$lib/app/composition';
import type { Customer, CustomerFormValues, CustomerSearchResult } from '$lib/domain/customers';

function createCustomerStore() {
	const internal = writable<Customer[]>([]);
	const { customerUseCases } = getAppServices();

	function hydrate(): void {
		internal.set(customerUseCases.getAll());
	}

	function create(form: CustomerFormValues) {
		const result = customerUseCases.create(form);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	function update(form: CustomerFormValues) {
		const result = customerUseCases.update(form);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	function remove(id: string) {
		const result = customerUseCases.remove(id);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	function search(query: string): CustomerSearchResult[] {
		return customerUseCases.search(query);
	}

	function getAll(): Customer[] {
		return get(internal);
	}

	function getById(id: string): Customer | null {
		return customerUseCases.getById(id);
	}

	function findOrCreateFromReservation(name: string, phone: string): Customer | null {
		const customer = customerUseCases.findOrCreateFromReservation(name, phone);
		if (customer) {
			internal.set(customerUseCases.getAll());
		}
		return customer;
	}

	function importCsv(csvText: string) {
		const result = customerUseCases.importCsv(csvText);
		internal.set(customerUseCases.getAll());
		return result;
	}

	return {
		subscribe: internal.subscribe,
		hydrate,
		create,
		update,
		remove,
		search,
		getAll,
		getById,
		findOrCreateFromReservation,
		importCsv
	};
}

export const customerStore = createCustomerStore();
