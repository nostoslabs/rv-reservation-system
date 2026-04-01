import type { Migration } from '../migrator';
import * as m001 from './001_initial';
import * as m002 from './002_add_status';
import * as m003 from './003_customers';
import * as m004 from './004_add_rv_type';
import * as m005 from './005_repair_rv_type';

export const allMigrations: Migration[] = [
	{ version: m001.version, up: m001.up },
	{ version: m002.version, up: m002.up },
	{ version: m003.version, up: m003.up },
	{ version: m004.version, up: m004.up },
	{ version: m005.version, up: m005.up }
];
