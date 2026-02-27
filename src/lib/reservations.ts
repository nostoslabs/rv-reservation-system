// Re-export from domain layer for backwards compatibility during migration.
export {
	MAX_RESERVATION_NOTES_LENGTH,
	buildCellId,
	buildFirstCellId,
	buildOccupancyMap,
	checkOverlap as rangesOverlap,
	isReservationColor,
	normalizeName,
	normalizePhoneNumber,
	normalizeReservationNotes,
	sanitizeReservationNotes,
	validateReservationForm
} from '$lib/domain/reservations';
