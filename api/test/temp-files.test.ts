// A test run must leave nothing in the system temp folder. This runs two other
// test files in a child vitest with TMPDIR pointed at an empty folder of its
// own: one makes its database copy when the file loads, the other inside a test.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("removes every database it made once the run is over", () => {
  const tmp = mkdtempSync(join(tmpdir(), "temp-files-check-"));
  try {
    const run = spawnSync("npx", ["vitest", "run", "test/read.test.ts", "test/reset.test.ts"], {
      cwd: join(import.meta.dirname, ".."),
      env: { ...process.env, TMPDIR: tmp },
      encoding: "utf8",
    });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(readdirSync(tmp).filter((name) => name.startsWith("oim-shop-"))).toEqual([]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}, 120_000);
