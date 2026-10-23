// A test run must leave nothing in the system temp folder. This runs another
// test file in a child vitest with TMPDIR pointed at an empty folder of its
// own; that file's tests each get a fresh copy of the database.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("removes every database it made once the run is over", () => {
  const tmp = mkdtempSync(join(tmpdir(), "temp-files-check-"));
  try {
    const run = spawnSync("npx", ["vitest", "run", "src/test/employees.test.tsx"], {
      cwd: join(import.meta.dirname, "..", ".."),
      env: { ...process.env, TMPDIR: tmp },
      encoding: "utf8",
    });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(readdirSync(tmp).filter((name) => name.startsWith("oim-shop-"))).toEqual([]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}, 120_000);
