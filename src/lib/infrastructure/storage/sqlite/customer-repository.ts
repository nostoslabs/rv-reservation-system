import type { CustomerRepository } from '$lib/application/ports/customer';
import type { Customer } from '$lib/domain/customers';
import type { Database } from './types';

interface CustomerRow {
	id: string;
	name: string;
	phone: string;
	email: string;
	notes: string;
	created_at: string;
	updated_at: string;
}

function rowToCustomer(row: CustomerRow): Customer {
	return {
		id: row.id,
		name: row.name,
		phone: row.phone,
		email: row.email,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

async function loadAllFromDb(db: Database): Promise<Customer[]> {
	const rows = await db.select<CustomerRow>(
		'SELECT id, name, phone, email, notes, created_at, updated_at FROM customers ORDER BY name'
	);
	return rows.map(rowToCustomer);
}

async function upsertToDb(db: Database, customer: Customer): Promise<void> {
	await db.execute(
		`INSERT OR REPLACE INTO customers (id, name, phone, email, notes, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			customer.id,
			customer.name,
			customer.phone,
			customer.email,
			customer.notes,
			customer.createdAt,
			customer.updatedAt
		]
	);
}

async function deleteFromDb(db: Database, id: string): Promise<void> {
	await db.execute('DELETE FROM customers WHERE id = ?', [id]);
}

export function createSqliteCustomerRepository(db: Database): CustomerRepository & {
	init(): Promise<void>;
} {
	let cache: Customer[] = [];

	return {
		async init() {
			cache = await loadAllFromDb(db);
		},

		getAll(): Customer[] {
			return [...cache];
		},

		getById(id: string): Customer | null {
			return cache.find((c) => c.id === id) ?? null;
		},

		save(customer: Customer): void {
			const idx = cache.findIndex((c) => c.id === customer.id);
			if (idx >= 0) {
				cache[idx] = customer;
			} else {
				cache.push(customer);
			}
			upsertToDb(db, customer).catch((err) =>
				console.error('SQLite customer save failed:', err)
			);
		},

		remove(id: string): void {
			cache = cache.filter((c) => c.id !== id);
			deleteFromDb(db, id).catch((err) =>
				console.error('SQLite customer delete failed:', err)
			);
		}
	};
}
