import type { CustomerFormValues } from './types';
import {
	MAX_CUSTOMER_NAME_LENGTH,
	MAX_CUSTOMER_PHONE_LENGTH,
	MAX_CUSTOMER_RV_TYPE_LENGTH,
	MAX_CUSTOMER_EMAIL_LENGTH,
	MAX_CUSTOMER_NOTES_LENGTH
} from './types';

/**
 * Parse a single CSV line respecting RFC 4180 quoting rules.
 * Handles quoted fields with embedded commas and escaped double quotes.
 */
function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const ch = line[i];

		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i += 2;
				} else {
					inQuotes = false;
					i++;
				}
			} else {
				current += ch;
				i++;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
				i++;
			} else if (ch === ',') {
				fields.push(current.trim());
				current = '';
				i++;
			} else {
				current += ch;
				i++;
			}
		}
	}

	fields.push(current.trim());
	return fields;
}

/**
 * Map header names (case-insensitive) to column indices.
 */
function mapHeaders(headers: string[]): { name: number; phone: number; rvType: number; email: number; notes: number } {
	const map: Record<string, number> = {};
	for (let i = 0; i < headers.length; i++) {
		map[headers[i].toLowerCase().trim()] = i;
	}

	return {
		name: map['name'] ?? -1,
		phone: map['phone'] ?? -1,
		rvType: map['rv_type'] ?? map['rvtype'] ?? map['rv type'] ?? -1,
		email: map['email'] ?? -1,
		notes: map['notes'] ?? -1
	};
}

export interface CsvParseResult {
	rows: CustomerFormValues[];
	errors: string[];
}

/**
 * Parse CSV text into customer form values.
 * Expected format: name,phone,email,notes header row, followed by data rows.
 * Tolerant: extra columns ignored, missing optional columns default to empty.
 */
export function parseCustomerCsv(text: string): CsvParseResult {
	const rows: CustomerFormValues[] = [];
	const errors: string[] = [];

	const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');

	if (lines.length === 0) {
		errors.push('File is empty.');
		return { rows, errors };
	}

	const headerFields = parseCsvLine(lines[0]);
	const indices = mapHeaders(headerFields);

	if (indices.name === -1) {
		errors.push('Missing required "name" column in header row.');
		return { rows, errors };
	}

	for (let i = 1; i < lines.length; i++) {
		const lineNum = i + 1;
		const fields = parseCsvLine(lines[i]);

		const name = (fields[indices.name] ?? '').trim();
		const phone = indices.phone >= 0 ? (fields[indices.phone] ?? '').trim() : '';
		const rvType = indices.rvType >= 0 ? (fields[indices.rvType] ?? '').trim() : '';
		const email = indices.email >= 0 ? (fields[indices.email] ?? '').trim() : '';
		const notes = indices.notes >= 0 ? (fields[indices.notes] ?? '').trim() : '';

		if (!name) {
			errors.push(`Row ${lineNum}: Name is required.`);
			continue;
		}

		if (name.length > MAX_CUSTOMER_NAME_LENGTH) {
			errors.push(`Row ${lineNum}: Name exceeds ${MAX_CUSTOMER_NAME_LENGTH} characters.`);
			continue;
		}

		if (phone.length > MAX_CUSTOMER_PHONE_LENGTH) {
			errors.push(`Row ${lineNum}: Phone exceeds ${MAX_CUSTOMER_PHONE_LENGTH} characters.`);
			continue;
		}

		if (rvType.length > MAX_CUSTOMER_RV_TYPE_LENGTH) {
			errors.push(`Row ${lineNum}: RV type exceeds ${MAX_CUSTOMER_RV_TYPE_LENGTH} characters.`);
			continue;
		}

		if (email.length > MAX_CUSTOMER_EMAIL_LENGTH) {
			errors.push(`Row ${lineNum}: Email exceeds ${MAX_CUSTOMER_EMAIL_LENGTH} characters.`);
			continue;
		}

		if (notes.length > MAX_CUSTOMER_NOTES_LENGTH) {
			errors.push(`Row ${lineNum}: Notes exceeds ${MAX_CUSTOMER_NOTES_LENGTH} characters.`);
			continue;
		}

		rows.push({ name, phone, rvType, email, notes });
	}

	return { rows, errors };
}
