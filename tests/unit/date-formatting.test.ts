import { describe, it, expect } from 'vitest';
import {
	formatScheduleHeader,
	formatReservationDetail,
	formatTimestamp,
	formatDisplayDate,
	formatLocalTimestamp
} from '$lib/date';

describe('formatScheduleHeader', () => {
	it('formats a Saturday in March', () => {
		expect(formatScheduleHeader('2026-03-07')).toBe('Sat, Mar 7');
	});

	it('formats a Monday in January', () => {
		expect(formatScheduleHeader('2026-01-05')).toBe('Mon, Jan 5');
	});

	it('formats New Years Day 2026 (Thursday)', () => {
		expect(formatScheduleHeader('2026-01-01')).toBe('Thu, Jan 1');
	});

	it('formats a date in December', () => {
		expect(formatScheduleHeader('2025-12-25')).toBe('Thu, Dec 25');
	});

	it('formats a date in February', () => {
		expect(formatScheduleHeader('2026-02-14')).toBe('Sat, Feb 14');
	});

	it('formats last day of year', () => {
		expect(formatScheduleHeader('2025-12-31')).toBe('Wed, Dec 31');
	});

	it('returns raw string for invalid input', () => {
		expect(formatScheduleHeader('not-a-date')).toBe('not-a-date');
	});

	it('handles single-digit days without zero-padding', () => {
		// Day 1 should show as "1", not "01"
		expect(formatScheduleHeader('2026-03-01')).toBe('Sun, Mar 1');
	});

	it('handles double-digit days', () => {
		expect(formatScheduleHeader('2026-03-15')).toBe('Sun, Mar 15');
	});
});

describe('formatReservationDetail', () => {
	it('formats a date with year', () => {
		expect(formatReservationDetail('2026-03-07')).toBe('Mar 7, 2026');
	});

	it('formats January 1st', () => {
		expect(formatReservationDetail('2026-01-01')).toBe('Jan 1, 2026');
	});

	it('formats December 31st', () => {
		expect(formatReservationDetail('2025-12-31')).toBe('Dec 31, 2025');
	});

	it('formats a leap day', () => {
		expect(formatReservationDetail('2024-02-29')).toBe('Feb 29, 2024');
	});

	it('returns raw string for invalid input', () => {
		expect(formatReservationDetail('bad')).toBe('bad');
	});

	it('handles all twelve months', () => {
		const months = [
			['2026-01-15', 'Jan 15, 2026'],
			['2026-02-15', 'Feb 15, 2026'],
			['2026-03-15', 'Mar 15, 2026'],
			['2026-04-15', 'Apr 15, 2026'],
			['2026-05-15', 'May 15, 2026'],
			['2026-06-15', 'Jun 15, 2026'],
			['2026-07-15', 'Jul 15, 2026'],
			['2026-08-15', 'Aug 15, 2026'],
			['2026-09-15', 'Sep 15, 2026'],
			['2026-10-15', 'Oct 15, 2026'],
			['2026-11-15', 'Nov 15, 2026'],
			['2026-12-15', 'Dec 15, 2026']
		];
		for (const [input, expected] of months) {
			expect(formatReservationDetail(input)).toBe(expected);
		}
	});
});

describe('formatTimestamp', () => {
	it('returns a non-empty string for a numeric timestamp', () => {
		const result = formatTimestamp(1709827200000);
		expect(result).toBeTruthy();
		expect(typeof result).toBe('string');
	});

	it('returns a non-empty string for a Date object', () => {
		const result = formatTimestamp(new Date(2026, 2, 7, 14, 30));
		expect(result).toBeTruthy();
		expect(typeof result).toBe('string');
	});

	it('includes the year in the output', () => {
		const result = formatTimestamp(new Date(2026, 2, 7, 14, 30));
		expect(result).toContain('2026');
	});

	it('includes the month abbreviation in the output', () => {
		const result = formatTimestamp(new Date(2026, 2, 7, 14, 30));
		expect(result).toContain('Mar');
	});
});

describe('formatDisplayDate (legacy)', () => {
	it('still works with DD/MM/YYYY format', () => {
		expect(formatDisplayDate('2026-03-07')).toBe('07/03/2026');
	});

	it('returns raw string for invalid input', () => {
		expect(formatDisplayDate('invalid')).toBe('invalid');
	});
});

describe('formatLocalTimestamp (legacy)', () => {
	it('returns a non-empty string', () => {
		const result = formatLocalTimestamp(1709827200000);
		expect(result).toBeTruthy();
		expect(typeof result).toBe('string');
	});
});
