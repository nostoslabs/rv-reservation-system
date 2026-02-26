import { compareIsoDates, enumerateDates, isIsoDateString } from '$lib/date';
import { RESERVATION_COLORS, type Reservation, type ReservationColor, type ReservationFormValues } from '$lib/types';

export const MAX_RESERVATION_NOTES_LENGTH = 128;

export function isReservationColor(value: string): value is ReservationColor {
  return (RESERVATION_COLORS as readonly string[]).includes(value);
}

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

export function buildCellId(parkingLocation: string, isoDate: string): string {
  return `${encodeURIComponent(parkingLocation)}::${isoDate}`;
}

export function buildFirstCellId(parkingLocation: string, startDate: string): string {
  return buildCellId(parkingLocation, startDate);
}

export function rangesOverlap(
  startA: string,
  endAExclusive: string,
  startB: string,
  endBExclusive: string
): boolean {
  return compareIsoDates(startA, endBExclusive) < 0 && compareIsoDates(startB, endAExclusive) < 0;
}

export function buildOccupancyMap(reservations: Reservation[]): Map<string, Reservation> {
  const occupancy = new Map<string, Reservation>();

  for (const reservation of reservations) {
    for (const date of enumerateDates(reservation.startDate, reservation.endDate)) {
      occupancy.set(buildCellId(reservation.parkingLocation, date), reservation);
    }
  }

  return occupancy;
}

export function validateReservationForm(
  form: ReservationFormValues,
  options: {
    existingReservations: Reservation[];
    parkingLocations: string[];
  }
): string[] {
  const errors: string[] = [];
  const name = normalizeName(form.name);
  const notes = normalizeReservationNotes(form.notes);

  if (!name) {
    errors.push('Name is required.');
  }

  if (notes.length > MAX_RESERVATION_NOTES_LENGTH) {
    errors.push(`Notes must be ${MAX_RESERVATION_NOTES_LENGTH} characters or fewer.`);
  }

  if (!isIsoDateString(form.startDate)) {
    errors.push('Start date must be a valid date.');
  }

  if (!isIsoDateString(form.endDate)) {
    errors.push('End date must be a valid date.');
  }

  if (isIsoDateString(form.startDate) && isIsoDateString(form.endDate)) {
    if (compareIsoDates(form.startDate, form.endDate) >= 0) {
      errors.push('End date must be after start date.');
    }
  }

  if (!options.parkingLocations.includes(form.parkingLocation)) {
    errors.push('Parking location must be one of the existing locations.');
  }

  if (!isReservationColor(form.color)) {
    errors.push('Color must be one of: red, green, blue, yellow, pink, orange, purple.');
  }

  if (errors.length > 0) {
    return errors;
  }

  for (const reservation of options.existingReservations) {
    if (typeof form.index === 'number' && reservation.index === form.index) {
      continue;
    }

    if (reservation.parkingLocation !== form.parkingLocation) {
      continue;
    }

    if (rangesOverlap(form.startDate, form.endDate, reservation.startDate, reservation.endDate)) {
      errors.push(
        `Overlap with reservation #${reservation.index} (${reservation.name}) at ${reservation.parkingLocation} from ${reservation.startDate} to ${reservation.endDate}.`
      );
      break;
    }
  }

  return errors;
}
