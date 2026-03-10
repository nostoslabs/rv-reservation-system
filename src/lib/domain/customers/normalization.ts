export { normalizeName, normalizePhoneNumber } from '$lib/domain/reservations/normalization';

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
