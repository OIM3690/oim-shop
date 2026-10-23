// Seeds one template database for the whole test run. Each test copies it,
// so the 600,000 order lines load once rather than once per test.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";
import { openDatabase } from "../src/db.ts";
import { loadSeed } from "../src/seed.ts";

/** The moment the tests treat as now, in Boston time. */
export const TEST_NOW = "2026-10-22T16:00:00";
export const TEST_SHIFT_DAYS = 1341;

export default function setup(project: TestProject) {
  const path = join(mkdtempSync(join(tmpdir(), "oim-shop-test-")), "template.db");
  const db = openDatabase(path);
  loadSeed(db, { shiftDays: TEST_SHIFT_DAYS, now: TEST_NOW });
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  project.provide("templateDb", path);
}

declare module "vitest" {
  export interface ProvidedContext {
    templateDb: string;
  }
}
