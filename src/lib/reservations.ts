// Re-export from domain layer for backwards compatibility during migration.
export {
	DEFAULT_RESERVATION_STATUS,
	MAX_RESERVATION_NOTES_LENGTH,
	buildCellId,
	buildFirstCellId,
	buildOccupancyMap,
	checkOverlap as rangesOverlap,
	isReservationColor,
	isReservationStatus,
	normalizeName,
	normalizePhoneNumber,
	normalizeReservationNotes,
	sanitizeReservationNotes,
	validateReservationForm
} from '$lib/domain/reservations';
