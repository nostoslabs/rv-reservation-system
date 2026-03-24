import { describe, it, expect } from 'vitest';
import { parseCustomerCsv } from '$lib/domain/customers/csv-parser';

describe('parseCustomerCsv', () => {
	it('parses valid CSV with all columns', () => {
		const csv = `name,phone,email,notes
John Smith,555-1234,john@example.com,Good customer
Jane Doe,555-5678,jane@example.com,Prefers pull-through`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(2);
		expect(result.rows[0]).toEqual({
			name: 'John Smith',
			phone: '555-1234',
			rvType: '',
			email: 'john@example.com',
			notes: 'Good customer'
		});
		expect(result.rows[1]).toEqual({
			name: 'Jane Doe',
			phone: '555-5678',
			rvType: '',
			email: 'jane@example.com',
			notes: 'Prefers pull-through'
		});
	});

	it('handles missing optional columns', () => {
		const csv = `name,phone
John Smith,555-1234`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toEqual({
			name: 'John Smith',
			phone: '555-1234',
			rvType: '',
			email: '',
			notes: ''
		});
	});

	it('handles name-only column', () => {
		const csv = `name
John Smith
Jane Doe`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(2);
		expect(result.rows[0].phone).toBe('');
		expect(result.rows[0].email).toBe('');
	});

	it('errors on empty file', () => {
		const result = parseCustomerCsv('');
		expect(result.errors).toContain('File is empty.');
		expect(result.rows).toEqual([]);
	});

	it('errors on missing name column', () => {
		const csv = `phone,email
555-1234,john@example.com`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toContain('Missing required "name" column in header row.');
		expect(result.rows).toEqual([]);
	});

	it('errors on rows with empty name', () => {
		const csv = `name,phone
,555-1234
John Smith,555-5678`;

		const result = parseCustomerCsv(csv);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].name).toBe('John Smith');
		expect(result.errors).toContain('Row 2: Name is required.');
	});

	it('handles quoted fields with commas', () => {
		const csv = `name,phone,email,notes
"Smith, John",555-1234,john@example.com,"Likes site A, prefers shade"`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].name).toBe('Smith, John');
		expect(result.rows[0].notes).toBe('Likes site A, prefers shade');
	});

	it('handles escaped double quotes in fields', () => {
		const csv = `name,phone,email,notes
"John ""JJ"" Smith",555-1234,,`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows[0].name).toBe('John "JJ" Smith');
	});

	it('ignores extra columns', () => {
		const csv = `name,phone,email,notes,extra_col
John Smith,555-1234,john@example.com,Good,ignored_value`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].name).toBe('John Smith');
	});

	it('handles headers only (no data rows)', () => {
		const csv = `name,phone,email,notes`;
		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toEqual([]);
	});

	it('handles Windows-style line endings', () => {
		const csv = "name,phone\r\nJohn Smith,555-1234\r\nJane Doe,555-5678";
		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(2);
	});

	it('skips blank lines', () => {
		const csv = `name,phone

John Smith,555-1234

Jane Doe,555-5678
`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(2);
	});

	it('enforces max name length', () => {
		const longName = 'A'.repeat(81);
		const csv = `name\n${longName}`;
		const result = parseCustomerCsv(csv);
		expect(result.rows).toEqual([]);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Name exceeds 80 characters');
	});

	it('case-insensitive header matching', () => {
		const csv = `Name,Phone,EMAIL,Notes
John,555-1234,john@test.com,note`;

		const result = parseCustomerCsv(csv);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].email).toBe('john@test.com');
	});
});
