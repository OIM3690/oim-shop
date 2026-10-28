// For the web app's tests: a seeded database and the real API in the same
// process, so those tests exercise the server instead of a copy of it.
import type { Role } from "./allowlist.ts";
import { createApp } from "./app.ts";
import { openDatabase, type Database } from "./db.ts";
import { assignReporting } from "./reporting.ts";
import { loadSeed } from "./seed.ts";
import { createSession, SESSION_COOKIE } from "./session.ts";

export const TEST_NOW = "2026-10-22T16:00:00";
export const TEST_SHIFT_DAYS = 1341;

/** Seeds a database at `path`. Removing it afterwards is the caller's job. */
export function seededDatabase(path: string): Database {
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
 * Makes a GitHub user with a role, optionally with a display name and so an
 * employee record, and a session for them, without going through GitHub.
 * Returns the Cookie header value.
 */
export function signInDirectly(db: Database, githubId: number, displayName?: string, role: Role = "rep") {
  db.prepare("INSERT INTO users (github_id, created_at, role, manager_since) VALUES (?, ?, ?, ?)").run(
    githubId,
    TEST_NOW,
    role,
    role === "manager" ? TEST_NOW : null,
  );
  const userId = Number(db.prepare("SELECT user_id FROM users WHERE github_id = ?").get(githubId)!.user_id);
  if (displayName) {
    db.prepare(
      `INSERT INTO employees (employee_id, first_name, last_name, title, hire_date, user_id)
       VALUES ((SELECT max(max(employee_id) + 1, 10) FROM employees), ?, '', 'Sales Representative', ?, ?)`,
    ).run(displayName, TEST_NOW.slice(0, 10), userId);
    assignReporting(db);
  }
  return `${SESSION_COOKIE}=${createSession(db, userId).token}`;
}

export { createApp, openDatabase, type Database };
