// Re-export from domain layer for backwards compatibility during migration.
export {
	MAX_RESERVATION_NOTES_LENGTH,
	DEFAULT_RESERVATION_STATUS,
	STATUS_BG_COLORS,
	STATUS_COLORS,
	STATUS_LABELS,
	buildCellId,
	buildFirstCellId,
	buildOccupancyMap,
	checkOverlap as rangesOverlap,
	getStatusBgColor,
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
