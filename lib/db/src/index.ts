// Zero-dependency JSON file store — no Postgres needed for local dev.
export { db, screeningsTable, mockRecordsTable, screeningRulesTable, eq, ilike, and, or, desc, asc, gte, lte, sql } from "./json-store.js";
export * from "./schema/screenings.js";
