// Re-export from domain layer for backwards compatibility during migration.
export {
	DEFAULT_RESERVATION_STATUS,
	MAX_RESERVATION_NOTES_LENGTH,
	STATUS_BACKGROUND_COLORS,
	STATUS_COLORS,
	STATUS_LABELS,
	buildCellId,
	buildFirstCellId,
	buildOccupancyMap,
	checkOverlap as rangesOverlap,
	getStatusBackgroundColor,
	getStatusColor,
	getStatusLabel,
	isReservationColor,
	isReservationStatus,
	normalizeName,
	normalizePhoneNumber,
	normalizeReservationNotes,
	sanitizeReservationNotes,
	validateReservationForm
} from '$lib/domain/reservations';
