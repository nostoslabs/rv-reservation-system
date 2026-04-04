import { browser } from '$app/environment';
import { isIsoDateString } from '$lib/date';
import { DEFAULT_RESERVATION_STATUS, isReservationColor, isReservationStatus, normalizePhoneNumber, sanitizeReservationNotes } from '$lib/reservations';
import type { AutoBackupIntervalMinutes, PersistedAppData, Reservation, ReservationStatus, SiteSettings } from '$lib/types';
import { AUTO_BACKUP_INTERVALS } from '$lib/types';

const STORAGE_KEY = 'rv-reservation-demo:v1';
const DATA_VERSION = 4;
const SETTINGS_STORAGE_KEY = 'rv-reservation-demo:settings:v1';

export const DEFAULT_SITE_NAME = 'RV Reservation Schedule';

export const DEFAULT_PARKING_LOCATIONS = [
  'A-01',
  'A-02',
  'A-03',
  'A-04',
  'B-01',
  'B-02',
  'B-03',
  'C-01',
  'C-02',
  'Overflow'
];

function defaultData(): PersistedAppData {
  return {
    version: DATA_VERSION,
    reservations: [],
    parkingLocations: [...DEFAULT_PARKING_LOCATIONS],
    nextReservationIndex: 1,
    lastSavedAt: null
  };
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }

  return output;
}

export function sanitizeReservation(value: unknown): Reservation | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.index !== 'number' || !Number.isInteger(raw.index) || raw.index <= 0) return null;
  if (typeof raw.firstCellId !== 'string') return null;
  if (typeof raw.name !== 'string') return null;
  if (typeof raw.startDate !== 'string' || !isIsoDateString(raw.startDate)) return null;
  if (typeof raw.endDate !== 'string' || !isIsoDateString(raw.endDate)) return null;
  if (typeof raw.parkingLocation !== 'string' || !raw.parkingLocation.trim()) return null;
  if (typeof raw.color !== 'string' || !isReservationColor(raw.color)) return null;

  // Migration: default status to 'reserved' for pre-v4 data (missing or removed statuses like 'due-out')
  const status: ReservationStatus =
    typeof raw.status === 'string' && isReservationStatus(raw.status)
      ? raw.status
      : DEFAULT_RESERVATION_STATUS;

  const phoneNumber =
    typeof raw.phoneNumber === 'string' ? normalizePhoneNumber(raw.phoneNumber) : '';
  const notes = typeof raw.notes === 'string' ? sanitizeReservationNotes(raw.notes) : '';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const customerId = typeof raw.customerId === 'string' && UUID_RE.test(raw.customerId) ? raw.customerId : undefined;

  const rvType = typeof raw.rvType === 'string' ? raw.rvType.trim() : '';

  return {
    index: raw.index,
    firstCellId: raw.firstCellId,
    name: raw.name.trim(),
    rvType,
    phoneNumber,
    notes,
    startDate: raw.startDate,
    endDate: raw.endDate,
    parkingLocation: raw.parkingLocation.trim(),
    color: raw.color,
    status,
    customerId
  };
}

function sanitizeData(value: unknown): PersistedAppData {
  const fallback = defaultData();
  if (!value || typeof value !== 'object') return fallback;

  const raw = value as Record<string, unknown>;
  const parkingLocations = sanitizeStringList(raw.parkingLocations);
  const reservations = Array.isArray(raw.reservations)
    ? raw.reservations.map(sanitizeReservation).filter((item): item is Reservation => item !== null)
    : [];

  reservations.sort((a, b) => a.index - b.index);

  const maxIndex = reservations.reduce((max, reservation) => Math.max(max, reservation.index), 0);
  const nextReservationIndex =
    typeof raw.nextReservationIndex === 'number' && Number.isInteger(raw.nextReservationIndex)
      ? Math.max(raw.nextReservationIndex, maxIndex + 1, 1)
      : Math.max(maxIndex + 1, 1);

  return {
    version: DATA_VERSION,
    reservations,
    parkingLocations: parkingLocations.length > 0 ? parkingLocations : [...DEFAULT_PARKING_LOCATIONS],
    nextReservationIndex,
    lastSavedAt: typeof raw.lastSavedAt === 'number' ? raw.lastSavedAt : null
  };
}

export function getDefaultPersistedAppData(): PersistedAppData {
  return defaultData();
}

export function loadPersistedAppData(): PersistedAppData {
  if (!browser) return defaultData();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultData();
    }

    return sanitizeData(JSON.parse(raw));
  } catch {
    return defaultData();
  }
}

export function savePersistedAppData(data: PersistedAppData): number {
  const savedAt = Date.now();
  if (!browser) return savedAt;

  const payload: PersistedAppData = {
    ...data,
    version: DATA_VERSION,
    lastSavedAt: savedAt
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return savedAt;
}

export function clearPersistedAppData(): void {
  if (!browser) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function sanitizeSiteSettings(value: unknown): SiteSettings {
  if (!value || typeof value !== 'object') {
    return {
      siteName: DEFAULT_SITE_NAME
    };
  }

  const raw = value as Record<string, unknown>;
  const siteName =
    typeof raw.siteName === 'string' && raw.siteName.trim()
      ? raw.siteName.trim().slice(0, 80)
      : DEFAULT_SITE_NAME;

  const compactView = typeof raw.compactView === 'boolean' ? raw.compactView : false;

  const result: SiteSettings = { siteName, compactView };

  if (raw.autoBackup && typeof raw.autoBackup === 'object') {
    const ab = raw.autoBackup as Record<string, unknown>;
    const rawInterval = typeof ab.intervalMinutes === 'number' ? ab.intervalMinutes : 0;
    const intervalMinutes: AutoBackupIntervalMinutes =
      (AUTO_BACKUP_INTERVALS as readonly number[]).includes(rawInterval)
        ? (rawInterval as AutoBackupIntervalMinutes)
        : 0;
    result.autoBackup = {
      intervalMinutes,
      directoryPath: typeof ab.directoryPath === 'string' ? ab.directoryPath : null,
      lastBackupAt: typeof ab.lastBackupAt === 'string' ? ab.lastBackupAt : null
    };
  }

  if (raw.siteColors && typeof raw.siteColors === 'object' && !Array.isArray(raw.siteColors)) {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    const sc = raw.siteColors as Record<string, unknown>;
    const cleaned: Record<string, string> = {};
    for (const [key, val] of Object.entries(sc)) {
      const trimmedKey = typeof key === 'string' ? key.trim() : '';
      const trimmedVal = typeof val === 'string' ? val.trim() : '';
      if (trimmedKey && trimmedVal && hexPattern.test(trimmedVal)) {
        cleaned[trimmedKey] = trimmedVal;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      result.siteColors = cleaned;
    }
  }

  return result;
}

export function loadSiteSettings(): SiteSettings {
  if (!browser) {
    return {
      siteName: DEFAULT_SITE_NAME
    };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        siteName: DEFAULT_SITE_NAME
      };
    }

    return sanitizeSiteSettings(JSON.parse(raw));
  } catch {
    return {
      siteName: DEFAULT_SITE_NAME
    };
  }
}

export function saveSiteSettings(settings: SiteSettings): SiteSettings {
  const sanitized = sanitizeSiteSettings(settings);
  if (!browser) return sanitized;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}
