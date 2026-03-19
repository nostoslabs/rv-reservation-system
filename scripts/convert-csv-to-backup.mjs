#!/usr/bin/env node
/**
 * Converts a DayPilot-style calendar CSV export into an AppBackup JSON file
 * compatible with the RV reservation system's backup/restore feature.
 *
 * Usage: node scripts/convert-csv-to-backup.mjs data/autoexport_0_260319_162214.csv
 */

import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { basename } from 'path';

const inputPath = process.argv[2];
if (!inputPath) {
	console.error('Usage: node scripts/convert-csv-to-backup.mjs <csv-file>');
	process.exit(1);
}

// ---------------------------------------------------------------------------
// CSV parsing — handles quoted fields with embedded commas and newlines
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
	const fields = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++; // skip escaped quote
				} else {
					inQuotes = false;
				}
			} else {
				current += ch;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				fields.push(current);
				current = '';
			} else {
				current += ch;
			}
		}
	}
	fields.push(current); // last field
	return fields;
}

// ---------------------------------------------------------------------------
// Color mapping — DayPilot stores decimal BGR integers
// ---------------------------------------------------------------------------

const COLOR_MAP = new Map([
	[8421631, 'blue'],     // 0x807FFF — periwinkle/blue
	[12632256, 'purple'],  // 0xC0C0C0 — gray → map to purple (checked-in/past)
	[16744703, 'pink'],    // 0xFF7FFF — pink
	[6524606, 'green'],    // 0x639C3E — green
	[16777088, 'yellow'],  // 0xFFFFC0 — light yellow
	[8421376, 'orange'],   // 0x808000 — olive → map to orange
	[8453888, 'green'],    // 0x80FF00 — lime green → green
	[255, 'red'],          // 0x0000FF — red (BGR)
	[16744576, 'orange'],  // fallback orange variant
]);

function mapColor(decimalColor) {
	return COLOR_MAP.get(decimalColor) || 'green';
}

// ---------------------------------------------------------------------------
// Phone extraction from notes field
// ---------------------------------------------------------------------------

function extractPhone(notes) {
	// Match common US phone patterns: 606-541-0148, (820)812-1494, 301.520.2882
	const phonePattern = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;
	const match = notes.match(phonePattern);
	return match ? match[0] : '';
}

// ---------------------------------------------------------------------------
// Site code extraction — embedded in a field like "C-5|,185,|"
// ---------------------------------------------------------------------------

function extractSiteCode(fields) {
	for (const field of fields) {
		const match = field.match(/^([A-Z]-\d+\.?)\|/);
		if (match) return match[1];
	}
	return '';
}

// ---------------------------------------------------------------------------
// Clean notes — replace chr(13)chr(10) with real newlines, trim junk
// ---------------------------------------------------------------------------

function cleanNotes(raw) {
	return raw
		.replace(/chr\(13\)chr\(10\)/gi, '\n')
		.replace(/chr\(13\)/gi, '')
		.replace(/chr\(10\)/gi, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

// ---------------------------------------------------------------------------
// Convert start/end date from "2023-04-07 00:00" to ISO date "2023-04-07"
// Strips any time component (00:00, 12:00, etc.)
// ---------------------------------------------------------------------------

function toIsoDate(dateStr) {
	return dateStr.replace(/ \d{1,2}:\d{2}(:\d{2})?$/, '').trim();
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

const csvText = readFileSync(inputPath, 'utf-8');
const lines = csvText.split('\n');

const reservations = [];
const customerMap = new Map(); // key: normalized "name|phone" → Customer
const parkingLocationSet = new Set();
let reservationIndex = 1;
let skippedEmpty = 0;

for (const line of lines) {
	if (!line.startsWith('"EVENT"')) continue;

	const fields = parseCsvLine(line);

	// fields[0] = "EVENT"
	// fields[1] = event ID
	// fields[2] = resource ID (e.g. ",205,")
	// fields[3] = customer name
	// fields[4] = notes (with chr(13)chr(10))
	// fields[5] = start date
	// fields[6] = end date
	// ...
	// field containing site code like "C-5|,185,|"

	const name = (fields[3] || '').trim();
	const rawNotes = fields[4] || '';
	const startDate = toIsoDate(fields[5] || '');
	const endDate = toIsoDate(fields[6] || '');
	let siteCode = extractSiteCode(fields);

	// Skip events with no name and no site (empty placeholder rows)
	if (!name && !siteCode) {
		skippedEmpty++;
		continue;
	}

	const cleanedNotes = cleanNotes(rawNotes);
	const phone = extractPhone(rawNotes);

	// Parse color from field index 11 (decimal integer)
	const colorValue = parseInt(fields[11], 10);
	const color = mapColor(colorValue);

	// Normalize "C-5." to "C-5" (client confirmed same site)
	if (siteCode === 'C-5.') siteCode = 'C-5';

	if (siteCode) {
		parkingLocationSet.add(siteCode);
	}

	// Build firstCellId: encodeURIComponent(parkingLocation) + "::" + startDate
	const firstCellId = `${encodeURIComponent(siteCode)}::${startDate}`;

	// Create or find customer
	let customerId;
	if (name) {
		const customerKey = `${name.toLowerCase()}|${phone}`;
		if (!customerMap.has(customerKey)) {
			const now = new Date().toISOString();
			customerMap.set(customerKey, {
				id: randomUUID(),
				name,
				phone,
				email: '',
				notes: '',
				createdAt: now,
				updatedAt: now
			});
		}
		customerId = customerMap.get(customerKey).id;
	}

	reservations.push({
		index: reservationIndex++,
		firstCellId,
		name: name || '(unnamed)',
		phoneNumber: phone,
		notes: cleanedNotes,
		startDate,
		endDate,
		parkingLocation: siteCode,
		color,
		status: 'reserved',
		...(customerId ? { customerId } : {})
	});
}

// Sort parking locations naturally: A-4, A-5, A-6, B-1, ..., D-1
const parkingLocations = [...parkingLocationSet].sort((a, b) => {
	const [aRow, aNum] = [a[0], parseFloat(a.slice(2))];
	const [bRow, bNum] = [b[0], parseFloat(b.slice(2))];
	if (aRow !== bRow) return aRow.localeCompare(bRow);
	return aNum - bNum;
});

const customers = [...customerMap.values()];

const backup = {
	schema: {
		version: 1,
		appName: 'rv-reservation-system',
		exportedAt: new Date().toISOString()
	},
	data: {
		reservations,
		parkingLocations,
		siteSettings: {
			siteName: 'RV Park',
			compactView: false
		},
		customers
	}
};

const outputPath = inputPath.replace(/\.csv$/i, '') + '_backup.json';
writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf-8');

console.log(`Conversion complete!`);
console.log(`  Reservations: ${reservations.length}`);
console.log(`  Customers:    ${customers.length}`);
console.log(`  Sites:        ${parkingLocations.length} — ${parkingLocations.join(', ')}`);
console.log(`  Skipped:      ${skippedEmpty} (empty/placeholder rows)`);
console.log(`  Output:       ${outputPath}`);
