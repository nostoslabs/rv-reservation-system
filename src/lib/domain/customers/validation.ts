import type { CustomerFormValues } from './types';
import {
	MAX_CUSTOMER_NAME_LENGTH,
	MAX_CUSTOMER_PHONE_LENGTH,
	MAX_CUSTOMER_RV_TYPE_LENGTH,
	MAX_CUSTOMER_EMAIL_LENGTH,
	MAX_CUSTOMER_NOTES_LENGTH
} from './types';
import { normalizeName, normalizePhoneNumber, normalizeEmail } from './normalization';

export function validateCustomerForm(form: CustomerFormValues): string[] {
	const errors: string[] = [];
	const name = normalizeName(form.name);
	const phone = normalizePhoneNumber(form.phone);
	const email = normalizeEmail(form.email);
	const notes = form.notes.trim();

	if (!name) {
		errors.push('Name is required.');
	} else if (name.length > MAX_CUSTOMER_NAME_LENGTH) {
		errors.push(`Name must be ${MAX_CUSTOMER_NAME_LENGTH} characters or fewer.`);
	}

	if (phone.length > MAX_CUSTOMER_PHONE_LENGTH) {
		errors.push(`Phone must be ${MAX_CUSTOMER_PHONE_LENGTH} characters or fewer.`);
	}

	const rvType = (form.rvType ?? '').trim();
	if (rvType.length > MAX_CUSTOMER_RV_TYPE_LENGTH) {
		errors.push(`RV type must be ${MAX_CUSTOMER_RV_TYPE_LENGTH} characters or fewer.`);
	}

	if (email.length > MAX_CUSTOMER_EMAIL_LENGTH) {
		errors.push(`Email must be ${MAX_CUSTOMER_EMAIL_LENGTH} characters or fewer.`);
	}

	if (notes.length > MAX_CUSTOMER_NOTES_LENGTH) {
		errors.push(`Notes must be ${MAX_CUSTOMER_NOTES_LENGTH} characters or fewer.`);
	}

	return errors;
}
