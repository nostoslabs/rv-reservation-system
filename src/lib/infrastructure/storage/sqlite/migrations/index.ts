import type { Migration } from '../migrator';
import * as m001 from './001_initial';

export const allMigrations: Migration[] = [{ version: m001.version, up: m001.up }];
