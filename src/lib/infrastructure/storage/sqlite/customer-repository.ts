import type { CustomerRepository } from '$lib/application/ports/customer';
import type { Customer } from '$lib/domain/customers';
import type { Database } from './types';
import type { SqliteWriteQueue } from './write-queue';

interface CustomerRow {
	id: string;
	name: string;
	phone: string;
	rv_type: string;
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
		rvType: row.rv_type,
		email: row.email,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function sortCustomers(customers: Customer[]): Customer[] {
	return [...customers].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadAllFromDb(db: Database): Promise<Customer[]> {
	const rows = await db.select<CustomerRow>(
		'SELECT id, name, phone, rv_type, email, notes, created_at, updated_at FROM customers ORDER BY name'
	);
	return rows.map(rowToCustomer);
}

async function upsertToDb(db: Database, customer: Customer): Promise<void> {
	await db.execute(
		`INSERT OR REPLACE INTO customers (id, name, phone, rv_type, email, notes, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			customer.id,
			customer.name,
			customer.phone,
			customer.rvType,
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

export function createSqliteCustomerRepository(db: Database, writes: SqliteWriteQueue): CustomerRepository & {
	init(): Promise<void>;
	flush(): Promise<void>;
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
			const snapshot = { ...customer };
			writes.enqueue(() => upsertToDb(db, snapshot), () => {
				const existing = cache.filter((c) => c.id !== snapshot.id);
				cache = sortCustomers([...existing, snapshot]);
			});
		},

		remove(id: string): void {
			writes.enqueue(() => deleteFromDb(db, id), () => {
				cache = cache.filter((c) => c.id !== id);
			});
		},

		replaceAll(customers: Customer[]): void {
			const snapshot = customers.map((customer) => ({ ...customer }));
			writes.enqueue(async () => {
				await db.execute('DELETE FROM customers');
				for (const customer of snapshot) {
					await upsertToDb(db, customer);
				}
			}, () => {
				cache = sortCustomers(snapshot);
			});
		},

		async flush(): Promise<void> {
			await writes.flush();
		}
	};
}
