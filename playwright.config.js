import { defineConfig, devices } from "@playwright/test";

// v1 is opened straight from disk. v3 is the real server (e2e/server.ts) on a
// seeded copy of the database, serving the built web app.
const V3_URL = "http://localhost:4173/";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    { name: "v1-desktop", testMatch: "v1.spec.js", use: { ...devices["Desktop Chrome"] } },
    { name: "v1-phone", testMatch: "v1.spec.js", use: { ...devices["Pixel 7"] } },
    { name: "v3-desktop", testMatch: "v3.spec.js", use: { ...devices["Desktop Chrome"], baseURL: V3_URL } },
    { name: "v3-phone", testMatch: "v3.spec.js", use: { ...devices["Pixel 7"], baseURL: V3_URL } },
  ],
  webServer: {
    command: "npm run build --workspace web && node e2e/server.ts",
    url: `${V3_URL}api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Without this Playwright kills the server outright, and it cannot remove its database.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
