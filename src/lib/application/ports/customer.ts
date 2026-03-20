import type { Customer } from '$lib/domain/customers';

export interface CustomerRepository {
	getAll(): Customer[];
	getById(id: string): Customer | null;
	save(customer: Customer): Promise<void>;
	remove(id: string): Promise<void>;
	replaceAll(customers: Customer[]): Promise<void>;
}
