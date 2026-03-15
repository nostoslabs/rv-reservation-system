import type { Customer } from '$lib/domain/customers';

export interface CustomerRepository {
	getAll(): Customer[];
	getById(id: string): Customer | null;
	save(customer: Customer): void;
	remove(id: string): void;
	replaceAll(customers: Customer[]): void;
}
