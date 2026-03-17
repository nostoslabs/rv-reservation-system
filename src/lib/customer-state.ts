import { writable, get } from 'svelte/store';
import { getAppServices } from '$lib/app/composition';
import type { Customer, CustomerFormValues, CustomerSearchResult } from '$lib/domain/customers';

function createCustomerStore() {
	const internal = writable<Customer[]>([]);

	function hydrate(): void {
		const { customerUseCases } = getAppServices();
		internal.set(customerUseCases.getAll());
	}

	function create(form: CustomerFormValues) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.create(form);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	function update(form: CustomerFormValues) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.update(form);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	function remove(id: string) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.remove(id);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	function search(query: string): CustomerSearchResult[] {
		const { customerUseCases } = getAppServices();
		return customerUseCases.search(query);
	}

	function getAll(): Customer[] {
		return get(internal);
	}

	function getById(id: string): Customer | null {
		const { customerUseCases } = getAppServices();
		return customerUseCases.getById(id);
	}

	function findOrCreateFromReservation(name: string, phone: string): Customer | null {
		const { customerUseCases } = getAppServices();
		const customer = customerUseCases.findOrCreateFromReservation(name, phone);
		if (customer) {
			internal.set(customerUseCases.getAll());
		}
		return customer;
	}

	function importCsv(csvText: string) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.importCsv(csvText);
		internal.set(customerUseCases.getAll());
		return result;
	}

	function replaceAll(customers: Customer[]): void {
		const { customerUseCases } = getAppServices();
		customerUseCases.replaceAll(customers);
		internal.set(customerUseCases.getAll());
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
		importCsv,
		replaceAll
	};
}

export const customerStore = createCustomerStore();
