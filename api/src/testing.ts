// For the web app's tests: a seeded database and the real API in the same
// process, so those tests exercise the server instead of a copy of it.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { openDatabase, type Database } from "./db.ts";
import { loadSeed } from "./seed.ts";
import { createSession, SESSION_COOKIE } from "./session.ts";

export const TEST_NOW = "2026-10-22T16:00:00";
export const TEST_SHIFT_DAYS = 1341;

export function seededDatabase(
  path = join(mkdtempSync(join(tmpdir(), "oim-shop-web-")), "shop.db"),
): Database {
  const db = openDatabase(path);
  loadSeed(db, { shiftDays: TEST_SHIFT_DAYS, now: TEST_NOW });
  return db;
}

export function testApp(db: Database, publicUrl = "http://localhost:3000") {
  return createApp({
    db,
    now: () => TEST_NOW,
    publicUrl,
    github: { clientId: "test", clientSecret: "test" },
    limits: { perAddress: 100_000, writesPerUser: 100_000 },
  });
}

/**
 * Makes a GitHub user, optionally a rep with a display name, and a session
 * for them, without going through GitHub. Returns the Cookie header value.
 */
export function signInDirectly(db: Database, githubId: number, displayName?: string) {
  db.prepare("INSERT INTO users (github_id, created_at) VALUES (?, ?)").run(githubId, TEST_NOW);
  const userId = Number(db.prepare("SELECT user_id FROM users WHERE github_id = ?").get(githubId)!.user_id);
  if (displayName) {
    db.prepare(
      `INSERT INTO employees (employee_id, first_name, last_name, title, reports_to, hire_date, user_id)
       VALUES ((SELECT max(max(employee_id) + 1, 10) FROM employees), ?, '', 'Sales Representative', 5, ?, ?)`,
    ).run(displayName, TEST_NOW.slice(0, 10), userId);
  }
  return `${SESSION_COOKIE}=${createSession(db, userId).token}`;
}

export { createApp, openDatabase, type Database };
