const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoParts(isoDate: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return [year, month, day];
}

export function isIsoDateString(value: string): boolean {
  return parseIsoParts(value) !== null;
}

export function isoDateToUtcMs(isoDate: string): number {
  const parts = parseIsoParts(isoDate);
  if (!parts) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  const [year, month, day] = parts;
  return Date.UTC(year, month - 1, day);
}

export function formatIsoDateFromUtcMs(utcMs: number): string {
  const date = new Date(utcMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  return formatIsoDateFromUtcMs(isoDateToUtcMs(isoDate) + days * DAY_MS);
}

export function diffDays(startIsoDate: string, endIsoDate: string): number {
  return Math.round((isoDateToUtcMs(endIsoDate) - isoDateToUtcMs(startIsoDate)) / DAY_MS);
}

export function compareIsoDates(a: string, b: string): number {
  const delta = isoDateToUtcMs(a) - isoDateToUtcMs(b);
  if (delta < 0) return -1;
  if (delta > 0) return 1;
  return 0;
}

export function formatDisplayDate(isoDate: string): string {
  const parts = parseIsoParts(isoDate);
  if (!parts) return isoDate;
  const [year, month, day] = parts;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

/**
 * Compact format for grid/schedule column headers.
 * Shows year when it differs from the current year or on Jan 1.
 * Examples: "Sat, Mar 7" (current year), "Thu, Apr 8 '27" (different year), "Wed, Jan 1 '27" (new year)
 */
export function formatScheduleHeader(isoDate: string, referenceYear?: number): string {
  const parts = parseIsoParts(isoDate);
  if (!parts) return isoDate;
  const [year, month, day] = parts;
  const utcMs = Date.UTC(year, month - 1, day);
  const dow = new Date(utcMs).getUTCDay();
  const currentYear = referenceYear ?? new Date().getFullYear();
  const showYear = year !== currentYear || (month === 1 && day === 1);
  if (showYear) {
    return `${SHORT_DAYS[dow]}, ${SHORT_MONTHS[month - 1]} ${day} '${String(year).slice(2)}`;
  }
  return `${SHORT_DAYS[dow]}, ${SHORT_MONTHS[month - 1]} ${day}`;
}

/**
 * Explicit format for reservation detail displays.
 * Example: "Mar 7, 2026"
 */
export function formatReservationDetail(isoDate: string): string {
  const parts = parseIsoParts(isoDate);
  if (!parts) return isoDate;
  const [year, month, day] = parts;
  return `${SHORT_MONTHS[month - 1]} ${day}, ${year}`;
}

/**
 * Locale-aware readable timestamp for autosave and audit displays.
 * Example: "Mar 7, 2026, 2:30 PM"
 */
export function formatTimestamp(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(d);
}

export function getTodayIsoLocal(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function enumerateDates(startIsoDate: string, endIsoDateExclusive: string): string[] {
  const totalDays = diffDays(startIsoDate, endIsoDateExclusive);
  if (totalDays <= 0) return [];

  const dates: string[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    dates.push(addDays(startIsoDate, offset));
  }
  return dates;
}

export function formatLocalTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp);
}
