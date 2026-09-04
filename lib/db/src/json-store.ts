/**
 * Zero-dependency JSON file store that mirrors the drizzle DB interface
 * used by the API server routes. No Postgres needed — data is persisted
 * to ./screening-data.json in the project root.
 */
import fs from "fs";
import path from "path";

const DATA_FILE = path.resolve(process.cwd(), "screening-data.json");

interface Store {
  screenings: Record<string, unknown>[];
  mockRecords: Record<string, unknown>[];
  screeningRules: Record<string, unknown>[];
  _nextId: { screenings: number; mockRecords: number; screeningRules: number };
}

function load(): Store {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Store;
    }
  } catch {}
  return {
    screenings: [],
    mockRecords: [],
    screeningRules: [],
    _nextId: { screenings: 1, mockRecords: 1, screeningRules: 1 },
  };
}

function save(store: Store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

let _store: Store = load();

function nextId(table: keyof Store["_nextId"]): number {
  const id = _store._nextId[table]++;
  return id;
}

// ── Screenings ────────────────────────────────────────────────────────────

export const screeningsTable = {
  _name: "screenings" as const,
};

export const mockRecordsTable = {
  _name: "mockRecords" as const,
};

export const screeningRulesTable = {
  _name: "screeningRules" as const,
};

// ── Re-export types so routes don't break ─────────────────────────────────

export type { InsertScreening, InsertMockRecord, InsertScreeningRules } from "./schema/screenings.js";

// ── Minimal drizzle-compatible db object ──────────────────────────────────

type Row = Record<string, unknown>;
type TableRef = typeof screeningsTable | typeof mockRecordsTable | typeof screeningRulesTable;

function tableData(ref: TableRef): Row[] {
  return _store[ref._name] as Row[];
}

function saveStore() {
  _store = { ..._store };
  save(_store);
}

export const db = {
  select: (fields?: unknown) => ({
    from: (table: TableRef) => ({
      _table: table,
      _wheres: [] as Array<(r: Row) => boolean>,
      _limit: Infinity as number,
      _order: null as null | { key: string; desc: boolean },

      where(fn: (r: Row) => boolean) {
        this._wheres.push(fn);
        return this;
      },
      orderBy(col: { _key: string; _desc?: boolean }) {
        this._order = { key: col._key, desc: !!col._desc };
        return this;
      },
      limit(n: number) {
        this._limit = n;
        return this;
      },
      then(resolve: (rows: Row[]) => void) {
        return Promise.resolve(this._exec()).then(resolve);
      },
      _exec(): Row[] {
        let rows = tableData(this._table).filter(r =>
          this._wheres.every(fn => fn(r))
        );
        if (this._order) {
          const { key, desc } = this._order;
          rows = [...rows].sort((a, b) => {
            const av = a[key] as string | number;
            const bv = b[key] as string | number;
            return desc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
          });
        }
        if (this._limit !== Infinity) rows = rows.slice(0, this._limit);
        return rows;
      },
      [Symbol.asyncIterator]() {
        const rows = this._exec();
        let i = 0;
        return { next: async () => i < rows.length ? { value: rows[i++], done: false } : { value: undefined as unknown as Row, done: true } };
      },
    }),
  }),

  insert: (table: TableRef) => ({
    values: (data: Row | Row[]) => ({
      returning() {
        const rows = Array.isArray(data) ? data : [data];
        const inserted: Row[] = [];
        for (const row of rows) {
          const idField = "id";
          const id = nextId(table._name as keyof Store["_nextId"]);
          const newRow: Row = {
            ...row,
            [idField]: id,
            createdAt: row.createdAt ?? new Date().toISOString(),
          };
          (tableData(table) as Row[]).push(newRow);
          inserted.push(newRow);
        }
        saveStore();
        return Promise.resolve(inserted);
      },
      then(resolve: (rows: Row[]) => void) {
        const rows = Array.isArray(data) ? data : [data];
        const inserted: Row[] = [];
        for (const row of rows) {
          const id = nextId(table._name as keyof Store["_nextId"]);
          const newRow: Row = { ...row, id, createdAt: row.createdAt ?? new Date().toISOString() };
          (tableData(table) as Row[]).push(newRow);
          inserted.push(newRow);
        }
        saveStore();
        return Promise.resolve(inserted).then(resolve);
      },
    }),
  }),

  update: (table: TableRef) => ({
    set: (updates: Partial<Row>) => ({
      where: (fn: (r: Row) => boolean) => ({
        returning(): Promise<Row[]> {
          const data = tableData(table);
          const updated: Row[] = [];
          for (let i = 0; i < data.length; i++) {
            if (fn(data[i])) {
              data[i] = { ...data[i], ...updates };
              updated.push(data[i]);
            }
          }
          saveStore();
          return Promise.resolve(updated);
        },
      }),
    }),
  }),

  delete: (table: TableRef) => ({
    where: (fn: (r: Row) => boolean) => {
      const data = _store[table._name] as Row[];
      _store[table._name] = data.filter(r => !fn(r)) as typeof data;
      saveStore();
      return Promise.resolve();
    },
  }),
};

// ── Query helper builders (match drizzle's eq/desc/asc/ilike/and/or/gte/lte) ──

export function eq(col: string, val: unknown) {
  return (r: Row) => r[col] === val;
}

export function ilike(col: string, pattern: string) {
  const regex = new RegExp(pattern.replace(/%/g, ".*").replace(/_/g, "."), "i");
  return (r: Row) => regex.test(String(r[col] ?? ""));
}

export function and(...fns: Array<(r: Row) => boolean>) {
  return (r: Row) => fns.every(fn => fn(r));
}

export function or(...fns: Array<(r: Row) => boolean>) {
  return (r: Row) => fns.some(fn => fn(r));
}

export function desc(col: string) {
  return { _key: col, _desc: true };
}

export function asc(col: string) {
  return { _key: col, _desc: false };
}

export function gte(col: string, val: Date | string | number) {
  return (r: Row) => {
    const rv = r[col];
    const a = rv instanceof Date ? rv : new Date(rv as string);
    const b = val instanceof Date ? val : new Date(val as string);
    return a >= b;
  };
}

export function lte(col: string, val: Date | string | number) {
  return (r: Row) => {
    const rv = r[col];
    const a = rv instanceof Date ? rv : new Date(rv as string);
    const b = val instanceof Date ? val : new Date(val as string);
    return a <= b;
  };
}

export function sql(strings: TemplateStringsArray, ...vals: unknown[]) {
  return {};
}
