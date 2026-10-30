import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { as, fakeGitHub, ORIGIN, signIn } from "./auth-helpers.ts";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

const server = setupServer(...fakeGitHub({ alice: 1001, bob: 1002 }));
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const github = { clientId: "test-client", clientSecret: "test-secret" };
const make = (publicUrl = ORIGIN) => {
  const db = freshDb();
  return { db, app: createApp({ db, now: () => TEST_NOW, publicUrl, github }) };
};

describe("sign-in", () => {
  it("sends you to GitHub asking for no scopes, with a state to check", async () => {
    const { app } = make();
    const response = await app.request("/api/auth/github");
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-client");
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/github/callback`);
    expect(location.searchParams.get("scope") ?? "").toBe("");
    expect(location.searchParams.get("state")).toMatch(/.{20,}/);
    expect(response.headers.getSetCookie().join()).toMatch(/oauth_state=.*HttpOnly/);
  });

  it("stores only the GitHub user ID, and asks a new rep to choose a name", async () => {
    const { app, db } = make();
    const { callback, cookie } = await signIn(app, "alice");
    expect(callback.status).toBe(302);
    expect(callback.headers.get("Location")).toBe(`${ORIGIN}/welcome`);
    expect(cookie).toMatch(/^session=/);
    expect(db.prepare("SELECT * FROM users").all()).toEqual([
      { user_id: 1, github_id: 1001, created_at: TEST_NOW, role: "rep", manager_since: null },
    ]);
    const stored =
      JSON.stringify(db.prepare("SELECT * FROM users").all()) +
      JSON.stringify(db.prepare("SELECT * FROM sessions").all());
    expect(stored).not.toMatch(/alice|example\.com|token-/);

    const me = schemas.me.parse(await (await app.request("/api/me", as(cookie))).json());
    expect(me).toEqual({ signed_in: true, role: "rep", employee: null });
  });

  it("says sign-in is not set up when the server has no OAuth App", async () => {
    const db = freshDb();
    const app = createApp({
      db,
      now: () => TEST_NOW,
      publicUrl: ORIGIN,
      github: { clientId: "", clientSecret: "" },
    });
    const response = await app.request("/api/auth/github");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ detail: "Sign-in is not set up on this server." });
  });

  it("refuses a callback whose state does not match", async () => {
    const { app } = make();
    const response = await app.request("/api/auth/github/callback?code=alice&state=forged", {
      headers: { Cookie: "oauth_state=real" },
    });
    expect(response.status).toBe(400);
  });

  it("refuses a code GitHub does not accept", async () => {
    const { app, db } = make();
    const { callback } = await signIn(app, "mallory");
    expect(callback.status).toBe(400);
    expect(one(db, "SELECT count(*) AS n FROM users").n).toBe(0);
  });

  it("makes a rep who reports to Steven Buchanan, under the name they choose", async () => {
    const { app } = make();
    const { cookie } = await signIn(app, "alice");
    const response = await app.request(
      "/api/me",
      as(cookie, { method: "PUT", json: { display_name: "  Ana Ruiz " } }),
    );
    expect(response.status).toBe(200);
    const me = schemas.me.parse(await response.json());
    expect(me.employee).toMatchObject({
      name: "Ana Ruiz",
      title: "Sales Representative",
      reports_to: 5,
      is_rep: true,
    });
    expect(me.employee!.employee_id).toBeGreaterThan(9);

    const listed = schemas.directory.parse(
      await (await app.request("/api/employees/directory", as(cookie))).json(),
    );
    expect(listed.map((e) => e.name)).toContain("Ana Ruiz");
  });

  it("refuses a display name that is empty, too long, or not plain text", async () => {
    const { app } = make();
    const { cookie } = await signIn(app, "alice");
    for (const display_name of ["", "  ", "x".repeat(41), "Ana\u0000Ruiz", "<b>Ana</b>"]) {
      const response = await app.request("/api/me", as(cookie, { method: "PUT", json: { display_name } }));
      expect(response.status).toBe(422);
    }
  });

  it("refuses unknown profile fields without changing the display name", async () => {
    const { app, db } = make();
    const { cookie } = await signIn(app, "alice");
    const response = await app.request(
      "/api/me",
      as(cookie, { method: "PUT", json: { display_name: "Ana", extra: "ignored" } }),
    );
    expect(response.status).toBe(422);
    expect(one(db, "SELECT count(*) AS n FROM employees WHERE user_id IS NOT NULL").n).toBe(0);
  });

  it("signs the same GitHub user back in to the same account", async () => {
    const { app, db } = make();
    const first = await signIn(app, "alice");
    await app.request("/api/me", as(first.cookie, { method: "PUT", json: { display_name: "Ana" } }));
    const second = await signIn(app, "alice");
    expect(second.callback.headers.get("Location")).toBe(`${ORIGIN}/`);
    expect(one(db, "SELECT count(*) AS n FROM users").n).toBe(1);
  });

  it("signs out, after which the cookie no longer works", async () => {
    const { app } = make();
    const { cookie } = await signIn(app, "alice");
    expect((await app.request("/api/auth/logout", as(cookie, { method: "POST" }))).status).toBe(204);
    expect(await (await app.request("/api/me", as(cookie))).json()).toEqual({
      signed_in: false,
      role: null,
      employee: null,
    });
  });

  it("refuses a write that comes from another site", async () => {
    const { app } = make();
    const { cookie } = await signIn(app, "alice");
    const response = await app.request("/api/me", {
      method: "PUT",
      headers: { Cookie: cookie, Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Ana" }),
    });
    expect(response.status).toBe(403);
  });

  it("marks the session cookie HttpOnly, Secure and SameSite=Lax on https", async () => {
    const { app } = make("https://shop.example");
    const { callback } = await signIn(app, "alice");
    const session = callback.headers.getSetCookie().find((c) => c.startsWith("session="))!;
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/Secure/);
    expect(session).toMatch(/SameSite=Lax/);
  });
});
