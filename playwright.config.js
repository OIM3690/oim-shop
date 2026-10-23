import { defineConfig, devices } from "@playwright/test";

// v1 is opened straight from disk. v2 is the built web app, served by
// `vite preview` from a build that answers oim-api requests with MSW.
const V2_URL = "http://localhost:4173/oim-shop/";

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
    { name: "v2-desktop", testMatch: "v2.spec.js", use: { ...devices["Desktop Chrome"], baseURL: V2_URL } },
    { name: "v2-phone", testMatch: "v2.spec.js", use: { ...devices["Pixel 7"], baseURL: V2_URL } },
  ],
  webServer: {
    command: "npm run e2e:serve --workspace web",
    url: V2_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
