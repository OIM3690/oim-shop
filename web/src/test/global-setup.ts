// Seeds one template database for the run; every test gets its own copy.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seededDatabase } from "api/testing";
import type { TestProject } from "vitest/node";

export default function setup(project: TestProject) {
  const path = join(mkdtempSync(join(tmpdir(), "oim-shop-web-template-")), "template.db");
  const db = seededDatabase(path);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  project.provide("templateDb", path);
}

declare module "vitest" {
  export interface ProvidedContext {
    templateDb: string;
  }
}
