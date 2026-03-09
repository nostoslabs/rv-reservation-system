import type { Migration } from '../migrator';
import * as m001 from './001_initial';
import * as m002 from './002_add_status';

export const allMigrations: Migration[] = [
	{ version: m001.version, up: m001.up },
	{ version: m002.version, up: m002.up }
];
