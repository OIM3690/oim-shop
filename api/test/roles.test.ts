// Who may sign in, and who reports to whom. A file on the server lists the
// GitHub accounts that may sign in, one per line, and a line can mark one as
// a manager. The server reads it at every sign-in, so a change takes effect
// at the person's next sign-in.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { parseAllowlist } from "../src/allowlist.ts";
import { createApp } from "../src/app.ts";
import { forgetAccounts } from "../src/forget.ts";
import * as schemas from "../src/schemas.ts";
import { as, fakeGitHub, ORIGIN, signIn } from "./auth-helpers.ts";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

// fakeGitHub answers with the login "user-<code>".
const server = setupServer(...fakeGitHub({ ana: 2001, ben: 2002, cai: 2003, dee: 2004, eve: 2005 }));
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const dir = mkdtempSync(join(tmpdir(), "oim-shop-allowlist-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function make(allowlist: string | null) {
  const file = join(dir, `allowed-${Math.random().toString(36).slice(2)}`);
  if (allowlist !== null) writeFileSync(file, allowlist);
  const db = freshDb();
  const app = createApp({
    db,
    now: () => TEST_NOW,
    publicUrl: ORIGIN,
    github: { clientId: "c", clientSecret: "s" },
    allowedUsersFile: file,
  });
  const join_ = async (code: string, name: string) => {
    const { cookie } = await signIn(app, code);
    const response = await app.request(
      "/api/me",
      as(cookie, { method: "PUT", json: { display_name: name } }),
    );
    return { cookie, me: schemas.me.parse(await response.json()) };
  };
  return { db, app, file, join: join_ };
}

const boss = (db: ReturnType<typeof freshDb>, employeeId: number) =>
  one(db, "SELECT reports_to FROM employees WHERE employee_id = ?", employeeId).reports_to;

describe("the allowlist file", () => {
  it("reads one GitHub login per line, any case, with an optional manager mark", () => {
    const list = parseAllowlist("# term roster\nUser-Ana\n\n  user-ben   manager  \nuser-cai teacher\n");
    expect([...list]).toEqual([
      ["user-ana", "rep"],
      ["user-ben", "manager"],
    ]);
  });
});

describe("signing in with an allowlist", () => {
  it("refuses an account that is not on the list, and stores nothing", async () => {
    const { app, db } = make("user-ana\n");
    const { callback, cookie } = await signIn(app, "ben");
    expect(callback.status).toBe(403);
    expect(cookie).toBe("");
    expect(one(db, "SELECT count(*) AS n FROM users").n).toBe(0);
  });

  it("lets in an account on the list, matched in any case", async () => {
    const { app } = make("USER-ANA\n");
    const { callback } = await signIn(app, "ana");
    expect(callback.status).toBe(302);
  });

  it("refuses everyone when the file is set but cannot be read", async () => {
    const { app } = make(null);
    expect((await signIn(app, "ana")).callback.status).toBe(403);
  });

  it("lets anyone in as a rep when no file is set, as on your own machine", async () => {
    const db = freshDb();
    const app = createApp({
      db,
      now: () => TEST_NOW,
      publicUrl: ORIGIN,
      github: { clientId: "c", clientSecret: "s" },
    });
    expect((await signIn(app, "eve")).callback.status).toBe(302);
    expect(one(db, "SELECT role FROM users").role).toBe("rep");
  });
});

describe("reporting lines", () => {
  it("has a rep report to Steven Buchanan until a manager has signed in", async () => {
    const { join } = make("user-ana\n");
    const { me } = await join("ana", "Ana");
    expect(me.role).toBe("rep");
    expect(me.employee).toMatchObject({ title: "Sales Representative", reports_to: 5 });
  });

  it("has a manager report to Andrew Fuller, and moves the reps who came before", async () => {
    const { db, join } = make("user-ana\nuser-ben manager\nuser-cai\n");
    const ana = (await join("ana", "Ana")).me.employee!;
    const ben = (await join("ben", "Ben")).me;
    expect(ben.role).toBe("manager");
    expect(ben.employee).toMatchObject({ title: "Sales Manager", reports_to: 2 });
    expect(boss(db, ana.employee_id)).toBe(ben.employee!.employee_id);
    const cai = (await join("cai", "Cai")).me.employee!;
    expect(cai.reports_to).toBe(ben.employee!.employee_id);
  });

  it("keeps reps with the first manager who signed in", async () => {
    const { db, join } = make("user-ana\nuser-ben manager\nuser-dee manager\n");
    const ben = (await join("ben", "Ben")).me.employee!;
    const dee = (await join("dee", "Dee")).me.employee!;
    const ana = (await join("ana", "Ana")).me.employee!;
    expect(ana.reports_to).toBe(ben.employee_id);
    expect(boss(db, dee.employee_id)).toBe(2);
  });

  it("makes a manager a rep at their next sign-in after the list changes", async () => {
    const { db, app, file, join } = make("user-ana\nuser-ben manager\n");
    const ana = (await join("ana", "Ana")).me.employee!;
    const ben = (await join("ben", "Ben")).me.employee!;
    expect(boss(db, ana.employee_id)).toBe(ben.employee_id);

    writeFileSync(file, "user-ana\nuser-ben\n");
    // Nothing changes until Ben signs in again.
    expect(one(db, "SELECT title FROM employees WHERE employee_id = ?", ben.employee_id).title).toBe(
      "Sales Manager",
    );
    const { cookie } = await signIn(app, "ben");
    const me = schemas.me.parse(await (await app.request("/api/me", as(cookie))).json());
    expect(me.role).toBe("rep");
    expect(me.employee).toMatchObject({ title: "Sales Representative", reports_to: 5 });
    expect(boss(db, ana.employee_id)).toBe(5);
  });
});

describe("the end-of-term cleanup", () => {
  it("forgets every rep and entered order, keeps the managers, and puts stock back", async () => {
    const { db, app, join } = make("user-ana\nuser-ben manager\n");
    const stock = () => one(db, "SELECT units_in_stock AS s FROM products WHERE product_id = 1").s;
    const before = stock();
    const ana = await join("ana", "Ana");
    const ben = (await join("ben", "Ben")).me.employee!;
    const order = {
      customer_id: "ALFKI",
      shipper_id: 1,
      required_date: "2026-11-05",
      freight: 1,
      lines: [{ product_id: 1, quantity: 3, discount: 0 }],
    };
    expect((await app.request("/api/orders", as(ana.cookie, { method: "POST", json: order }))).status).toBe(
      201,
    );

    const result = forgetAccounts(db);

    expect(result).toEqual({ accountsRemoved: 1, ordersRemoved: 1 });
    expect(stock()).toBe(before);
    expect(one(db, "SELECT count(*) AS n FROM orders WHERE entered_by_user IS NOT NULL").n).toBe(0);
    expect(db.prepare("SELECT first_name, title FROM employees WHERE user_id IS NOT NULL").all()).toEqual([
      { first_name: "Ben", title: "Sales Manager" },
    ]);
    expect(one(db, "SELECT count(*) AS n FROM users").n).toBe(1);
    expect(one(db, "SELECT count(*) AS n FROM employees WHERE employee_id = ?", ben.employee_id).n).toBe(1);
    expect((await app.request("/api/me", as(ana.cookie))).status).toBe(200);
    expect(schemas.me.parse(await (await app.request("/api/me", as(ana.cookie))).json()).signed_in).toBe(
      false,
    );
  });
});
