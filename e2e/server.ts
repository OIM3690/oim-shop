// The server the v3 end-to-end tests run against: the real app on a seeded
// copy of the database, at a fixed moment, with GitHub's OAuth endpoints
// answered by MSW inside this process. The browser half of sign-in (the
// redirect to github.com) is answered by Playwright in the tests.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupServer } from "msw/node";
import { seededDatabase, TEST_NOW } from "../api/src/testing.ts";
import { startServer } from "../api/src/serve.ts";
import { fakeGitHub } from "../api/test/auth-helpers.ts";

export const E2E_PORT = 4173;
const origin = `http://localhost:${E2E_PORT}`;

setupServer(...fakeGitHub({ ana: 5001, ben: 5002 })).listen({ onUnhandledFrame: "bypass" });

const dir = mkdtempSync(join(tmpdir(), "oim-shop-e2e-"));
const db = seededDatabase(join(dir, "shop.db"));

// Playwright stops this server with SIGTERM (gracefulShutdown in
// playwright.config.js), and Ctrl+C sends SIGINT; either way the database goes.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  });
}

startServer({
  db,
  now: () => TEST_NOW,
  publicUrl: origin,
  github: { clientId: "e2e-client", clientSecret: "e2e-secret" },
  limits: { perAddress: 100_000, writesPerUser: 100_000 },
  port: E2E_PORT,
  host: "127.0.0.1",
  webDist: new URL("../web/dist", import.meta.url).pathname,
});
