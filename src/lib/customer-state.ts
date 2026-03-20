import { writable, get } from 'svelte/store';
import { flushPendingWrites, getAppServices } from '$lib/app/composition';
import { rvReservationStore } from '$lib/state';
import type { Customer, CustomerFormValues, CustomerSearchResult } from '$lib/domain/customers';
import type { MergeCustomersResult } from '$lib/application/use-cases';

const CUSTOMER_PERSISTENCE_ERROR = 'Unable to save customer data to disk.';

function createCustomerStore() {
	const internal = writable<Customer[]>([]);

	function hydrate(): void {
		const { customerUseCases } = getAppServices();
		internal.set(customerUseCases.getAll());
	}

	async function refreshCustomers(): Promise<void> {
		await flushPendingWrites();
		internal.set(getAppServices().customerUseCases.getAll());
	}

	async function create(form: CustomerFormValues) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.create(form);
		if (!result.ok) {
			return result;
		}

		try {
			await refreshCustomers();
			return result;
		} catch (error) {
			console.error('Failed to persist customer create:', error);
			return { ok: false as const, errors: [CUSTOMER_PERSISTENCE_ERROR] };
		}
	}

	async function update(form: CustomerFormValues) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.update(form);
		if (!result.ok) {
			return result;
		}

		try {
			await refreshCustomers();
			return result;
		} catch (error) {
			console.error('Failed to persist customer update:', error);
			return { ok: false as const, errors: [CUSTOMER_PERSISTENCE_ERROR] };
		}
	}

	async function remove(id: string) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.remove(id);
		if (!result.ok) {
			return result;
		}

		try {
			await refreshCustomers();
			return result;
		} catch (error) {
			console.error('Failed to persist customer delete:', error);
			return { ok: false as const, errors: [CUSTOMER_PERSISTENCE_ERROR] };
		}
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
		const customer = customerUseCases.findOrCreateFromReservation(name, phone);
		if (!customer) {
			return null;
		}

		try {
			await refreshCustomers();
			return customer;
		} catch (error) {
			console.error('Failed to persist customer auto-create:', error);
			return null;
		}
	}

	async function importCsv(csvText: string) {
		const { customerUseCases } = getAppServices();
		const result = customerUseCases.importCsv(csvText);

		try {
			await refreshCustomers();
			return result;
		} catch (error) {
			console.error('Failed to persist customer CSV import:', error);
			return {
				...result,
				errors: [...result.errors, CUSTOMER_PERSISTENCE_ERROR]
			};
		}
	}

	async function replaceAll(customers: Customer[]): Promise<{ ok: true } | { ok: false; errors: string[] }> {
		const { customerUseCases } = getAppServices();
		customerUseCases.replaceAll(customers);

		try {
			await refreshCustomers();
			return { ok: true };
		} catch (error) {
			console.error('Failed to persist customer replacement:', error);
			return { ok: false, errors: [CUSTOMER_PERSISTENCE_ERROR] };
		}
	}

	async function mergeCustomers(
		customerIds: string[],
		overrides?: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes'>>
	): Promise<MergeCustomersResult> {
		const { mergeCustomersUseCases, repositories } = getAppServices();
		const appData = repositories.appData.load();
		const result = mergeCustomersUseCases.merge(customerIds, appData, overrides);
		if (!result.ok) {
			return result;
		}

		const persistResult = await rvReservationStore.importData(result.data);
		if (!persistResult.ok) {
			return { ok: false, errors: persistResult.errors ?? [CUSTOMER_PERSISTENCE_ERROR] };
		}

		internal.set(getAppServices().customerUseCases.getAll());
		return result;
	}

	function findDuplicateGroups(): Customer[][] {
		const { mergeCustomersUseCases } = getAppServices();
		return mergeCustomersUseCases.findDuplicates();
	}

	async function deduplicateAll(): Promise<{ groupsMerged: number; reservationsRelinked: number; errors?: string[] }> {
		const { mergeCustomersUseCases, repositories } = getAppServices();
		const appData = repositories.appData.load();
		const result = mergeCustomersUseCases.deduplicateAll(appData);
		if (result.groupsMerged === 0) {
			return { groupsMerged: 0, reservationsRelinked: 0 };
		}

		const persistResult = await rvReservationStore.importData(result.data);
		if (!persistResult.ok) {
			return {
				groupsMerged: 0,
				reservationsRelinked: 0,
				errors: persistResult.errors ?? [CUSTOMER_PERSISTENCE_ERROR]
			};
		}

		internal.set(getAppServices().customerUseCases.getAll());
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
