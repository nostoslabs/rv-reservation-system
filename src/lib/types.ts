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

export interface Reservation {
  index: number;
  firstCellId: string;
  name: string;
  phoneNumber: string;
  notes: string;
  startDate: string;
  endDate: string;
  parkingLocation: string;
  color: ReservationColor;
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
  phoneNumber: string;
  notes: string;
  startDate: string;
  endDate: string;
  parkingLocation: string;
  color: ReservationColor;
}

export interface SiteSettings {
  siteName: string;
  adminPasscode: string;
}

export interface ActionResult {
  ok: true;
}

export interface ActionError {
  ok: false;
  errors: string[];
}

export type MutationResult = ActionResult | ActionError;
