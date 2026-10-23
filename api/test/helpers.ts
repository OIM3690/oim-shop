import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inject } from "vitest";
import { openDatabase, type Database } from "../src/db.ts";

export { TEST_NOW, TEST_SHIFT_DAYS } from "./global-setup.ts";

/** A private copy of the seeded template database. */
export function freshDb(): Database {
  const path = join(mkdtempSync(join(tmpdir(), "oim-shop-")), "shop.db");
  copyFileSync(inject("templateDb"), path);
  return openDatabase(path);
}

export const one = (db: Database, sql: string, ...params: (string | number | null)[]) =>
  db.prepare(sql).get(...params) as Record<string, unknown>;
