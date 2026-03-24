import { describe, it, expect } from 'vitest';
import { validateCustomerForm } from '$lib/domain/customers/validation';

describe('validateCustomerForm', () => {
	it('returns no errors for valid form', () => {
		const errors = validateCustomerForm({
			name: 'John Smith',
			phone: '555-1234',
			rvType: 'Fifth Wheel',
			email: 'john@example.com',
			notes: 'Good customer'
		});
		expect(errors).toEqual([]);
	});

	it('requires name', () => {
		const errors = validateCustomerForm({
			name: '',
			phone: '',
			rvType: '',
			email: '',
			notes: ''
		});
		expect(errors).toContain('Name is required.');
	});

	it('requires name after trimming whitespace', () => {
		const errors = validateCustomerForm({
			name: '   ',
			phone: '',
			rvType: '',
			email: '',
			notes: ''
		});
		expect(errors).toContain('Name is required.');
	});

	it('enforces max name length', () => {
		const errors = validateCustomerForm({
			name: 'A'.repeat(81),
			phone: '',
			rvType: '',
			email: '',
			notes: ''
		});
		expect(errors).toContain('Name must be 80 characters or fewer.');
	});

	it('enforces max phone length', () => {
		const errors = validateCustomerForm({
			name: 'John',
			phone: '1'.repeat(41),
			rvType: '',
			email: '',
			notes: ''
		});
		expect(errors).toContain('Phone must be 40 characters or fewer.');
	});

	it('enforces max rv type length', () => {
		const errors = validateCustomerForm({
			name: 'John',
			phone: '',
			rvType: 'X'.repeat(61),
			email: '',
			notes: ''
		});
		expect(errors).toContain('RV type must be 60 characters or fewer.');
	});

	it('enforces max email length', () => {
		const errors = validateCustomerForm({
			name: 'John',
			phone: '',
			rvType: '',
			email: 'a'.repeat(121),
			notes: ''
		});
		expect(errors).toContain('Email must be 120 characters or fewer.');
	});

	it('enforces max notes length', () => {
		const errors = validateCustomerForm({
			name: 'John',
			phone: '',
			rvType: '',
			email: '',
			notes: 'N'.repeat(501)
		});
		expect(errors).toContain('Notes must be 500 characters or fewer.');
	});

	it('allows optional fields to be empty', () => {
		const errors = validateCustomerForm({
			name: 'John',
			phone: '',
			rvType: '',
			email: '',
			notes: ''
		});
		expect(errors).toEqual([]);
	});
});
