// The web tests talk to the real API: MSW catches each request the page
// makes to /api and hands it to the Hono app, which reads a private copy of
// the seeded database. A browser would add the session cookie and its Origin
// header itself; jsdom does not, so the handler adds them.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, signInDirectly, testApp, type Database } from "api/testing";
import { http } from "msw";
import { setupServer } from "msw/node";
import { inject } from "vitest";

const ORIGIN = "http://localhost:3000";

let db: Database;
let app: ReturnType<typeof testApp>;
let cookie = "";

export const server = setupServer(
  http.all(`${ORIGIN}/api/*`, ({ request }) => {
    const headers = new Headers(request.headers);
    if (cookie) headers.set("Cookie", cookie);
    headers.set("Origin", ORIGIN);
    return app.fetch(new Request(request, { headers }));
  }),
);

/** Starts each test from a fresh copy of the seeded database, signed out. */
export function resetApi() {
  const path = join(mkdtempSync(join(tmpdir(), "oim-shop-web-")), "shop.db");
  copyFileSync(inject("templateDb"), path);
  db = openDatabase(path, { migrate: false });
  app = testApp(db, ORIGIN);
  cookie = "";
}

/** The database behind the API, for tests that check what a page should show. */
export const testDb = () => db;

/** Signs in as a GitHub user; with a name, as a rep who has chosen it. */
export function signInAs(githubId: number, displayName?: string) {
  cookie = signInDirectly(db, githubId, displayName);
}

export const value = (sql: string, ...params: (string | number)[]) =>
  Object.values(db.prepare(sql).get(...params) ?? {})[0];
