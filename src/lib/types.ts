// Backwards-compatibility shim — import from $lib/domain/models instead.
export {
	AUTO_BACKUP_INTERVALS,
	RESERVATION_COLORS,
	RESERVATION_STATUSES
} from '$lib/domain/models';
export type {
	ActionError,
	ActionResult,
	AppState,
	AutoBackupConfig,
	AutoBackupIntervalMinutes,
	MutationResult,
	PersistedAppData,
	Reservation,
	ReservationColor,
	ReservationFormValues,
	ReservationStatus,
	SiteSettings
} from '$lib/domain/models';
