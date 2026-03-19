import type { AppDataRepository } from '$lib/application/ports';
import type { PersistedAppData, Reservation, ReservationColor, ReservationStatus } from '$lib/domain/models';
import { buildFirstCellId, DEFAULT_RESERVATION_STATUS, isReservationStatus } from '$lib/domain/reservations';
import { DEFAULT_PARKING_LOCATIONS } from '$lib/storage';
import type { Database } from './types';

const DATA_VERSION = 3;

interface ReservationRow {
	id: number;
	name: string;
	phone_number: string;
	notes: string;
	start_date: string;
	end_date: string;
	parking_location: string;
	color: string;
	status: string | null;
	customer_id: string | null;
}

interface MetadataRow {
	key: string;
	value: string;
}

interface LocationRow {
	name: string;
	sort_order: number;
}

function getDefaultData(): PersistedAppData {
	return {
		version: DATA_VERSION,
		reservations: [],
		parkingLocations: [...DEFAULT_PARKING_LOCATIONS],
		nextReservationIndex: 1,
		lastSavedAt: null
	};
}

function rowToReservation(row: ReservationRow): Reservation {
	const status: ReservationStatus =
		typeof row.status === 'string' && isReservationStatus(row.status)
			? row.status
			: DEFAULT_RESERVATION_STATUS;

	const reservation: Reservation = {
		index: row.id,
		firstCellId: buildFirstCellId(row.parking_location, row.start_date),
		name: row.name,
		phoneNumber: row.phone_number,
		notes: row.notes,
		startDate: row.start_date,
		endDate: row.end_date,
		parkingLocation: row.parking_location,
		color: row.color as ReservationColor,
		status
	};

	if (row.customer_id) {
		reservation.customerId = row.customer_id;
	}

	return reservation;
}

async function loadFromDb(db: Database): Promise<PersistedAppData> {
	const locationRows = await db.select<LocationRow>(
		'SELECT name, sort_order FROM parking_locations ORDER BY sort_order'
	);
	const parkingLocations =
		locationRows.length > 0 ? locationRows.map((r) => r.name) : [...DEFAULT_PARKING_LOCATIONS];

	const reservationRows = await db.select<ReservationRow>(
		'SELECT * FROM reservations ORDER BY parking_location, start_date, id'
	);
	const reservations = reservationRows.map(rowToReservation);

	const metaRows = await db.select<MetadataRow>('SELECT * FROM app_metadata');
	const meta = new Map(metaRows.map((r) => [r.key, r.value]));

	const maxIndex = reservations.reduce((m, r) => Math.max(m, r.index), 0);
	const storedNext = meta.get('next_reservation_index');
	const nextReservationIndex = storedNext
		? Math.max(parseInt(storedNext, 10), maxIndex + 1, 1)
		: Math.max(maxIndex + 1, 1);

	const storedSavedAt = meta.get('last_saved_at');
	const lastSavedAt = storedSavedAt ? parseInt(storedSavedAt, 10) : null;

	return {
		version: DATA_VERSION,
		reservations,
		parkingLocations,
		nextReservationIndex,
		lastSavedAt
	};
}

async function saveToDb(db: Database, data: PersistedAppData): Promise<number> {
	const savedAt = Date.now();

	// Use a transaction for atomicity — prevents partial writes on crash
	await db.execute('BEGIN TRANSACTION');
	try {
		// Delete reservations FIRST (they reference parking_locations via FK)
		await db.execute('DELETE FROM reservations');

		// Now safe to delete and re-insert parking locations
		await db.execute('DELETE FROM parking_locations');
		for (let i = 0; i < data.parkingLocations.length; i++) {
			await db.execute('INSERT INTO parking_locations (name, sort_order) VALUES (?, ?)', [
				data.parkingLocations[i],
				i
			]);
		}

		// Re-insert reservations (parking_locations rows exist now)
		for (const r of data.reservations) {
			await db.execute(
				'INSERT INTO reservations (id, name, phone_number, notes, start_date, end_date, parking_location, color, status, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
				[r.index, r.name, r.phoneNumber, r.notes, r.startDate, r.endDate, r.parkingLocation, r.color, r.status, r.customerId ?? null]
			);
		}

		// Sync metadata
		await db.execute('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)', [
			'next_reservation_index',
			String(data.nextReservationIndex)
		]);
		await db.execute('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)', [
			'last_saved_at',
			String(savedAt)
		]);

		await db.execute('COMMIT');
	} catch (err) {
		await db.execute('ROLLBACK').catch(() => {});
		throw err;
	}

	return savedAt;
}

async function clearDb(db: Database): Promise<void> {
	await db.execute('DELETE FROM reservations'); // FK child first
	await db.execute('DELETE FROM parking_locations');
	await db.execute('DELETE FROM app_metadata');
}

/**
 * Create a SQLite-backed AppDataRepository.
 * Must be initialized with `init()` before use — this pre-loads data
 * into an in-memory cache so the synchronous port interface is satisfied.
 */
export function createSqliteAppDataRepository(db: Database): AppDataRepository & {
	init(): Promise<void>;
	flush(): Promise<void>;
} {
	let cache: PersistedAppData = getDefaultData();
	let pendingWrite: Promise<void> = Promise.resolve();

	return {
		async init() {
			cache = await loadFromDb(db);
		},

		getDefaultData,

		load(): PersistedAppData {
			return cache;
		},

		save(data: PersistedAppData): number {
			// Write-through: update cache immediately, persist async
			cache = { ...data, version: DATA_VERSION };
			pendingWrite = saveToDb(db, cache).then(
				(savedAt) => {
					cache = { ...cache, lastSavedAt: savedAt };
				},
				(err) => {
					console.error('SQLite save failed:', err);
				}
			);
			return Date.now();
		},

		clear(): void {
			cache = getDefaultData();
			pendingWrite = clearDb(db).catch((err) => console.error('SQLite clear failed:', err));
		},

		async flush(): Promise<void> {
			await pendingWrite;
		}
	};
}
