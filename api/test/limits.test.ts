import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { as, fakeGitHub, signIn } from "./auth-helpers.ts";
import { freshDb, TEST_NOW } from "./helpers.ts";

const server = setupServer(...fakeGitHub({ alice: 1001 }));
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const make = (limits: { perAddress: number; writesPerUser: number }) =>
  createApp({
    db: freshDb(),
    now: () => TEST_NOW,
    github: { clientId: "c", clientSecret: "s" },
    clientIpHeader: "x-test-ip",
    limits,
  });

describe("rate limits", () => {
  it("answers 429 with Retry-After once one address asks too often", async () => {
    const app = make({ perAddress: 3, writesPerUser: 100 });
    const ask = (ip: string) => app.request("/api/categories", { headers: { "x-test-ip": ip } });
    for (let i = 0; i < 3; i++) expect((await ask("10.0.0.1")).status).toBe(200);
    const refused = await ask("10.0.0.1");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await ask("10.0.0.2")).status).toBe(200);
  });

  it("limits how many writes one rep makes", async () => {
    const app = make({ perAddress: 1000, writesPerUser: 2 });
    const { cookie } = await signIn(app, "alice");
    const rename = () => app.request("/api/me", as(cookie, { method: "PUT", json: { display_name: "Ana" } }));
    expect((await rename()).status).toBe(200);
    expect((await rename()).status).toBe(200);
    expect((await rename()).status).toBe(429);
    expect((await app.request("/api/me", as(cookie))).status).toBe(200);
  });
});

describe("caching", () => {
  it("lets a shared cache keep anonymous reads for a minute", async () => {
    const app = make({ perAddress: 1000, writesPerUser: 100 });
    expect((await app.request("/api/products")).headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  it("tells a cache that an anonymous read differs once you sign in", async () => {
    // Without this, a browser that read a page signed out could reuse that
    // copy for a minute after sign-in, without personal details or names.
    const app = make({ perAddress: 1000, writesPerUser: 100 });
    expect((await app.request("/api/employees/1")).headers.get("Vary")).toBe("Cookie");
  });

  it("never lets a shared cache keep what depends on who is signed in", async () => {
    const app = make({ perAddress: 1000, writesPerUser: 100 });
    const { cookie } = await signIn(app, "alice");
    expect((await app.request("/api/products", as(cookie))).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect((await app.request("/api/me")).headers.get("Cache-Control")).toBe("private, no-store");
    expect((await app.request("/api/health")).headers.get("Cache-Control")).toBe("no-store");
  });
});
