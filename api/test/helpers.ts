import { copyFileSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { inject } from "vitest";
import { openDatabase, type Database } from "../src/db.ts";

export { TEST_NOW, TEST_SHIFT_DAYS } from "./global-setup.ts";

/** A private copy of the seeded template database, removed with the template when the run ends. */
export function freshDb(): Database {
  const template = inject("templateDb");
  const path = join(mkdtempSync(join(dirname(template), "copy-")), "shop.db");
  copyFileSync(template, path);
  return openDatabase(path);
}

export const one = (db: Database, sql: string, ...params: (string | number | null)[]) =>
  db.prepare(sql).get(...params) as Record<string, unknown>;
