import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { as, fakeGitHub, signIn } from "./auth-helpers.ts";
import { freshDb, TEST_NOW } from "./helpers.ts";
import { signInDirectly } from "../src/testing.ts";

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

describe("request body limits", () => {
  const maxBytes = 16 * 1024;

  function setup() {
    const db = freshDb();
    const cookie = signInDirectly(db, 7001, "Ana");
    const app = createApp({ db, now: () => TEST_NOW });
    const headers = { Cookie: cookie, Origin: "http://localhost:5173", "Content-Type": "application/json" };
    return { db, app, headers };
  }

  it("accepts a body at the limit and refuses a larger declared body without writing", async () => {
    const { db, app, headers } = setup();
    const body = JSON.stringify({ display_name: "Ben" }).padEnd(maxBytes);
    const accepted = await app.request("/api/me", {
      method: "PUT",
      headers: { ...headers, "Content-Length": String(maxBytes) },
      body,
    });
    expect(accepted.status).toBe(200);
    const refused = await app.request("/api/me", {
      method: "PUT",
      headers: { ...headers, "Content-Length": String(maxBytes + 1) },
      body: JSON.stringify({ display_name: "Carol" }).padEnd(maxBytes + 1),
    });
    expect(refused.status).toBe(413);
    expect(await refused.json()).toEqual({ detail: "The request body must be at most 16 KiB." });
    expect(db.prepare("SELECT first_name FROM employees WHERE user_id IS NOT NULL").get()!.first_name).toBe(
      "Ben",
    );
  });

  it("counts streamed bytes without Content-Length before parsing JSON", async () => {
    const { db, app, headers } = setup();
    const bytes = new TextEncoder().encode(
      JSON.stringify({ display_name: "Ana", extra: "é".repeat(maxBytes / 2) }),
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, maxBytes));
        controller.enqueue(bytes.slice(maxBytes));
        controller.close();
      },
    });
    const request = new Request("http://localhost:5173/api/me", {
      method: "PUT",
      headers,
      body: stream,
      duplex: "half",
    });
    expect((await app.request(request)).status).toBe(413);
    expect(db.prepare("SELECT first_name FROM employees WHERE user_id IS NOT NULL").get()!.first_name).toBe(
      "Ana",
    );
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
