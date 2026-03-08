export { computeDailySummary } from './daily-summary';
export type { DailySummary } from './daily-summary';

export {
	MAX_RESERVATION_NOTES_LENGTH,
	normalizeName,
	normalizePhoneNumber,
	normalizeReservationNotes,
	sanitizeReservationNotes
} from './normalization';

export {
	buildCellId,
	buildFirstCellId,
	buildOccupancyMap
} from './occupancy';

export {
	DEFAULT_RESERVATION_STATUS,
	STATUS_BACKGROUND_COLORS,
	STATUS_COLORS,
	STATUS_LABELS,
	getStatusBackgroundColor,
	getStatusColor,
	getStatusLabel,
	isReservationStatus
} from './status';

export {
	checkOverlap,
	isReservationColor,
	validateReservationDates,
	validateReservationForm
} from './validation';
