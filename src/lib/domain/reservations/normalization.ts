export const MAX_RESERVATION_NOTES_LENGTH = 128;

export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, ' ');
}

export function normalizePhoneNumber(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

export function normalizeReservationNotes(value: string): string {
	return value.replace(/\r\n?/g, '\n').trim();
}

export function sanitizeReservationNotes(value: string): string {
	return normalizeReservationNotes(value).slice(0, MAX_RESERVATION_NOTES_LENGTH);
}
