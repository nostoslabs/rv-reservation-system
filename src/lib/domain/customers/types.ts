export interface Customer {
	id: string;
	name: string;
	phone: string;
	rvType: string;
	email: string;
	notes: string;
	createdAt: string;
	updatedAt: string;
}

export interface CustomerFormValues {
	id?: string;
	name: string;
	phone: string;
	rvType: string;
	email: string;
	notes: string;
}

export interface CustomerSearchResult {
	customer: Customer;
	score: number;
}

export const MAX_CUSTOMER_NAME_LENGTH = 80;
export const MAX_CUSTOMER_PHONE_LENGTH = 40;
export const MAX_CUSTOMER_EMAIL_LENGTH = 120;
export const MAX_CUSTOMER_RV_TYPE_LENGTH = 60;
export const MAX_CUSTOMER_NOTES_LENGTH = 500;
