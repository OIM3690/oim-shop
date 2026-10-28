import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { upgradeSeededDatabase } from "./northwind.ts";
import { assignReporting } from "./reporting.ts";

const MIGRATIONS = new URL("../../db/migrations/", import.meta.url);

export type Database = DatabaseSync;

// Work a migration needs that SQL alone cannot do, such as reading the seed
// files. It runs after the migration's SQL, in the same transaction.
const AFTER_MIGRATION: Record<string, (db: Database) => void> = {
  "002-every-column.sql": upgradeSeededDatabase,
  "003-roles.sql": assignReporting,
};

/**
 * Opens the SQLite file and applies any migration it has not seen yet. A copy
 * of a database that is already migrated can skip that step, as the web app's
 * tests do (they run in jsdom, where the migrations folder is not reachable).
 */
export function openDatabase(path: string, { migrate: applyMigrations = true } = {}): Database {
  const db = new DatabaseSync(path);
  // WAL lets the web server read while sync or reset writes.
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  // SQLite's own lower() only knows ASCII, so "RÖSSLE" would not find
  // "Rössle". fold() lowercases with JavaScript's full Unicode rules.
  db.function("fold", { deterministic: true }, (text) => (text === null ? null : String(text).toLowerCase()));
  if (applyMigrations) migrate(db);
  return db;
}

function migrate(db: Database) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(
    db
      .prepare("SELECT name FROM schema_migrations")
      .all()
      .map((row) => String(row.name)),
  );
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    if (applied.has(name)) continue;
    transaction(db, () => {
      db.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
      AFTER_MIGRATION[name]?.(db);
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(
        name,
        new Date().toISOString(),
      );
    });
  }
}

/** Runs work inside one transaction: everything is written, or nothing is. */
export function transaction<T>(db: Database, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
