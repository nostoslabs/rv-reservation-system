import { writable, get } from 'svelte/store';
import { getAppServices } from '$lib/app/composition';
import { rvReservationStore } from '$lib/state';
import type { Customer, CustomerFormValues, CustomerSearchResult } from '$lib/domain/customers';
import type { MergeCustomersResult } from '$lib/application/use-cases';

function createCustomerStore() {
	const internal = writable<Customer[]>([]);

	function hydrate(): void {
		const { customerUseCases } = getAppServices();
		internal.set(customerUseCases.getAll());
	}

	async function create(form: CustomerFormValues) {
		const { customerUseCases } = getAppServices();
		const result = await customerUseCases.create(form);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	async function update(form: CustomerFormValues) {
		const { customerUseCases } = getAppServices();
		const result = await customerUseCases.update(form);
		if (result.ok) {
			internal.set(customerUseCases.getAll());
		}
		return result;
	}

	async function remove(id: string) {
		const { customerUseCases } = getAppServices();
		const result = await customerUseCases.remove(id);
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

	async function findOrCreateFromReservation(name: string, phone: string): Promise<Customer | null> {
		const { customerUseCases } = getAppServices();
		const customer = await customerUseCases.findOrCreateFromReservation(name, phone);
		if (customer) {
			internal.set(customerUseCases.getAll());
		}
		return customer;
	}

	async function importCsv(csvText: string) {
		const { customerUseCases } = getAppServices();
		const result = await customerUseCases.importCsv(csvText);
		internal.set(customerUseCases.getAll());
		return result;
	}

	async function replaceAll(customers: Customer[]): Promise<void> {
		const { customerUseCases } = getAppServices();
		await customerUseCases.replaceAll(customers);
		internal.set(customerUseCases.getAll());
	}

	async function mergeCustomers(
		customerIds: string[],
		overrides?: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes'>>
	): Promise<MergeCustomersResult> {
		const { mergeCustomersUseCases, repositories } = getAppServices();
		const appData = repositories.appData.load();
		const result = await mergeCustomersUseCases.merge(customerIds, appData, overrides);
		if (result.ok) {
			internal.set(getAppServices().customerUseCases.getAll());
			await rvReservationStore.importData(result.data);
		}
		return result;
	}

	function findDuplicateGroups(): Customer[][] {
		const { mergeCustomersUseCases } = getAppServices();
		return mergeCustomersUseCases.findDuplicates();
	}

	async function deduplicateAll(): Promise<{ groupsMerged: number; reservationsRelinked: number }> {
		const { mergeCustomersUseCases, repositories } = getAppServices();
		const appData = repositories.appData.load();
		const result = await mergeCustomersUseCases.deduplicateAll(appData);
		if (result.groupsMerged > 0) {
			internal.set(getAppServices().customerUseCases.getAll());
			await rvReservationStore.importData(result.data);
		}
		return { groupsMerged: result.groupsMerged, reservationsRelinked: result.reservationsRelinked };
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
		replaceAll,
		mergeCustomers,
		findDuplicateGroups,
		deduplicateAll
	};
}

export const customerStore = createCustomerStore();
