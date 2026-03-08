import type { Database } from '$lib/infrastructure/storage/sqlite/types';

interface Row {
	[key: string]: unknown;
}

/**
 * Minimal in-memory "database" for testing the migrator and repositories.
 * Stores tables as arrays of plain objects. Supports only the subset of SQL
 * used by the app's migrations and repositories.
 */
export function createInMemoryDb(): Database & {
	tables: Map<string, Row[]>;
	indexes: Set<string>;
	dump(): Record<string, Row[]>;
} {
	const tables = new Map<string, Row[]>();
	const indexes = new Set<string>();

	function parseCreateTable(sql: string): string | null {
		const m = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
		return m ? m[1] : null;
	}

	function parseCreateIndex(sql: string): string | null {
		const m = sql.match(/CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
		return m ? m[1] : null;
	}

	function parseInsert(sql: string): { table: string; columns: string[] } | null {
		const m = sql.match(
			/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i
		);
		if (!m) return null;
		return {
			table: m[1],
			columns: m[2].split(',').map((c) => c.trim())
		};
	}

	function parseSelect(sql: string): {
		table: string;
		columns: string[];
		where?: string;
		orderBy?: string;
	} | null {
		const m = sql.match(
			/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?$/is
		);
		if (!m) return null;
		return {
			columns: m[1].split(',').map((c) => c.trim()),
			table: m[2],
			where: m[3]?.trim(),
			orderBy: m[4]?.trim()
		};
	}

	function parseDelete(sql: string): { table: string; where?: string } | null {
		const m = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?$/is);
		if (!m) return null;
		return { table: m[1], where: m[2]?.trim() };
	}

	function parseUpdate(sql: string): {
		table: string;
		sets: string[];
		where?: string;
	} | null {
		const m = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+?))?$/is);
		if (!m) return null;
		return {
			table: m[1],
			sets: m[2].split(',').map((s) => s.trim()),
			where: m[3]?.trim()
		};
	}

	function parseAlterTableAddColumn(sql: string): {
		table: string;
		column: string;
		defaultValue?: string;
	} | null {
		const m = sql.match(
			/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s+.*?(?:DEFAULT\s+'([^']*)')?$/is
		);
		if (!m) return null;
		return {
			table: m[1],
			column: m[2],
			defaultValue: m[3]
		};
	}

	function evaluateWhere(
		row: Row,
		whereClause: string,
		params: unknown[],
		paramOffset: number
	): { match: boolean; consumed: number } {
		// Simple single-column WHERE: "column = ?"
		const eqMatch = whereClause.match(/^(\w+)\s*=\s*\?$/);
		if (eqMatch) {
			return { match: row[eqMatch[1]] === params[paramOffset], consumed: 1 };
		}
		// Fallback: treat as always matching (for MAX queries etc.)
		return { match: true, consumed: 0 };
	}

	function evaluateAggregate(
		rows: Row[],
		expr: string
	): unknown {
		const maxMatch = expr.match(/MAX\((\w+)\)/i);
		if (maxMatch) {
			const col = maxMatch[1];
			const vals = rows.map((r) => r[col] as number | null).filter((v) => v != null);
			return vals.length > 0 ? Math.max(...(vals as number[])) : null;
		}
		const countMatch = expr.match(/COUNT\(\*\)/i);
		if (countMatch) {
			return rows.length;
		}
		return null;
	}

	const db: Database & {
		tables: Map<string, Row[]>;
		indexes: Set<string>;
		dump(): Record<string, Row[]>;
	} = {
		tables,
		indexes,

		async execute(sql: string, params: unknown[] = []): Promise<void> {
			const trimmed = sql.trim();

			// CREATE TABLE
			const tableName = parseCreateTable(trimmed);
			if (tableName) {
				if (!tables.has(tableName)) {
					tables.set(tableName, []);
				}
				return;
			}

			// CREATE INDEX
			const indexName = parseCreateIndex(trimmed);
			if (indexName) {
				indexes.add(indexName);
				return;
			}

			// ALTER TABLE ADD COLUMN
			const alter = parseAlterTableAddColumn(trimmed);
			if (alter) {
				const rows = tables.get(alter.table);
				if (!rows) throw new Error(`Table ${alter.table} does not exist`);
				// Add the new column with default value to all existing rows
				for (const row of rows) {
					if (!(alter.column in row)) {
						row[alter.column] = alter.defaultValue ?? null;
					}
				}
				return;
			}

			// INSERT
			const ins = parseInsert(trimmed);
			if (ins) {
				const rows = tables.get(ins.table);
				if (!rows) throw new Error(`Table ${ins.table} does not exist`);
				const row: Row = {};
				for (let i = 0; i < ins.columns.length; i++) {
					row[ins.columns[i]] = params[i];
				}
				// OR REPLACE: remove existing row with same primary key (first column)
				if (/INSERT\s+OR\s+REPLACE/i.test(trimmed)) {
					const pk = ins.columns[0];
					const idx = rows.findIndex((r) => r[pk] === row[pk]);
					if (idx >= 0) rows.splice(idx, 1);
				}
				rows.push(row);
				return;
			}

			// DELETE
			const del = parseDelete(trimmed);
			if (del) {
				const rows = tables.get(del.table);
				if (!rows) throw new Error(`Table ${del.table} does not exist`);
				if (del.where) {
					for (let i = rows.length - 1; i >= 0; i--) {
						const { match } = evaluateWhere(rows[i], del.where, params, 0);
						if (match) rows.splice(i, 1);
					}
				} else {
					rows.length = 0;
				}
				return;
			}

			// UPDATE
			const upd = parseUpdate(trimmed);
			if (upd) {
				const rows = tables.get(upd.table);
				if (!rows) throw new Error(`Table ${upd.table} does not exist`);
				let paramIdx = 0;
				const setOps = upd.sets.map((s) => {
					const [col] = s.split('=').map((p) => p.trim());
					return { col, paramIndex: paramIdx++ };
				});
				const whereParamOffset = paramIdx;
				for (const row of rows) {
					if (upd.where) {
						const { match } = evaluateWhere(row, upd.where, params, whereParamOffset);
						if (!match) continue;
					}
					for (const op of setOps) {
						row[op.col] = params[op.paramIndex];
					}
				}
				return;
			}

			throw new Error(`Unsupported SQL in execute: ${trimmed.slice(0, 80)}`);
		},

		async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
			const trimmed = sql.trim();
			const sel = parseSelect(trimmed);
			if (!sel) throw new Error(`Unsupported SQL in select: ${trimmed.slice(0, 80)}`);

			const rows = tables.get(sel.table) ?? [];
			let filtered = rows;

			if (sel.where) {
				filtered = rows.filter((r) => {
					const { match } = evaluateWhere(r, sel.where!, params, 0);
					return match;
				});
			}

			// Check for aggregate functions
			const isAggregate = sel.columns.some((c) => /\b(MAX|MIN|COUNT|SUM|AVG)\s*\(/i.test(c));
			if (isAggregate) {
				const result: Row = {};
				for (const col of sel.columns) {
					const alias = col.match(/AS\s+(\w+)/i);
					const key = alias ? alias[1] : col;
					result[key] = evaluateAggregate(filtered, col);
				}
				return [result as T];
			}

			// Order by
			if (sel.orderBy) {
				const parts = sel.orderBy.split(',').map((p) => {
					const [col, dir] = p.trim().split(/\s+/);
					return { col, desc: dir?.toUpperCase() === 'DESC' };
				});
				filtered = [...filtered].sort((a, b) => {
					for (const { col, desc } of parts) {
						const av = a[col] as string | number;
						const bv = b[col] as string | number;
						if (av < bv) return desc ? 1 : -1;
						if (av > bv) return desc ? -1 : 1;
					}
					return 0;
				});
			}

			// Project columns
			if (sel.columns.length === 1 && sel.columns[0] === '*') {
				return filtered.map((r) => ({ ...r }) as T);
			}
			return filtered.map((r) => {
				const out: Row = {};
				for (const col of sel.columns) {
					out[col] = r[col];
				}
				return out as T;
			}) as T[];
		},

		dump(): Record<string, Row[]> {
			const result: Record<string, Row[]> = {};
			for (const [name, rows] of tables) {
				result[name] = [...rows];
			}
			return result;
		}
	};

	return db;
}
