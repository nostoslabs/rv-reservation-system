export const RESERVATION_COLORS = [
  'red',
  'green',
  'blue',
  'yellow',
  'pink',
  'orange',
  'purple'
] as const;

export type ReservationColor = (typeof RESERVATION_COLORS)[number];

export const RESERVATION_STATUSES = ['reserved', 'checked-in', 'group-one', 'group-two', 'special', 'alert', 'maintenance'] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface Reservation {
  index: number;
  firstCellId: string;
  name: string;
  rvType: string;
  phoneNumber: string;
  notes: string;
  startDate: string;
  endDate: string;
  parkingLocation: string;
  color: ReservationColor;
  status: ReservationStatus;
  customerId?: string;
}

export interface PersistedAppData {
  version: number;
  reservations: Reservation[];
  parkingLocations: string[];
  nextReservationIndex: number;
  lastSavedAt: number | null;
}

export interface AppState extends PersistedAppData {
  hydrated: boolean;
}

export interface ReservationFormValues {
  index?: number;
  name: string;
  rvType: string;
  phoneNumber: string;
  notes: string;
  startDate: string;
  endDate: string;
  parkingLocation: string;
  color: ReservationColor;
  status: ReservationStatus;
  customerId?: string;
}

export const AUTO_BACKUP_INTERVALS = [0, 5, 10, 30, 60, 120, 240, 480, 1440] as const;
export type AutoBackupIntervalMinutes = (typeof AUTO_BACKUP_INTERVALS)[number];

export interface AutoBackupConfig {
  intervalMinutes: AutoBackupIntervalMinutes;
  directoryPath: string | null;
  lastBackupAt: string | null;
}

export interface SiteSettings {
  siteName: string;
  compactView?: boolean;
  autoBackup?: AutoBackupConfig;
  betaUpdates?: boolean;
  siteColors?: Record<string, string>;
}

export interface ActionResult {
  ok: true;
}

export interface ActionError {
  ok: false;
  errors: string[];
}

export type MutationResult = ActionResult | ActionError;
