export type { Customer, CustomerFormValues, CustomerSearchResult } from './types';
export {
	MAX_CUSTOMER_NAME_LENGTH,
	MAX_CUSTOMER_PHONE_LENGTH,
	MAX_CUSTOMER_RV_TYPE_LENGTH,
	MAX_CUSTOMER_EMAIL_LENGTH,
	MAX_CUSTOMER_NOTES_LENGTH
} from './types';

export { normalizeName, normalizePhoneNumber, normalizeEmail } from './normalization';
export { validateCustomerForm } from './validation';
export { searchCustomers } from './search';
export { findDuplicateCustomer } from './duplicates';
export { resolveCustomerMerge, findDuplicateGroups } from './merge';
export type { MergeResolution } from './merge';
export { parseCustomerCsv } from './csv-parser';
export type { CsvParseResult } from './csv-parser';
