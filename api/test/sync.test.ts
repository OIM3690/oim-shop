import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { syncOrders } from "../src/sync.ts";
import { fakeOimApi, OIM_API } from "./fake-oim-api.ts";
import { freshDb, one, TEST_NOW, TEST_SHIFT_DAYS } from "./helpers.ts";

const LATER = "2026-10-24T09:00:00";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const moved = (column: string) => `strftime('%Y-%m-%dT%H:%M:%S', ${column}, '+${TEST_SHIFT_DAYS} days')`;
const placedBetween = (db: ReturnType<typeof freshDb>, after: string, upTo: string) =>
  db
    .prepare(
      `SELECT order_id FROM seed_orders WHERE ${moved("order_date")} > ? AND ${moved("order_date")} <= ? ORDER BY 1`,
    )
    .all(after, upTo)
    .map((r) => Number(r.order_id));

const run = (db: ReturnType<typeof freshDb>) => syncOrders(db, { apiBase: OIM_API, now: LATER, pauseMs: 0 });

describe("sync", () => {
  it("adds the orders placed since the last run, with their lines and totals", async () => {
    const db = freshDb();
    server.use(...fakeOimApi(db, { now: LATER, shiftDays: TEST_SHIFT_DAYS }));
    const expected = placedBetween(db, TEST_NOW, LATER);
    expect(expected.length).toBeGreaterThan(0);

    const result = await run(db);

    expect(result.added).toBe(expected.length);
    const stored = db
      .prepare(`SELECT order_id FROM orders WHERE order_date > ? ORDER BY 1`)
      .all(TEST_NOW)
      .map((r) => Number(r.order_id));
    expect(stored).toEqual(expected);
    for (const id of expected) {
      const lines = one(db, "SELECT count(*) AS n FROM order_lines WHERE order_id = ?", id).n;
      expect(lines).toBe(one(db, "SELECT count(*) AS n FROM seed_order_lines WHERE order_id = ?", id).n);
      expect(one(db, "SELECT line_count FROM orders WHERE order_id = ?", id).line_count).toBe(lines);
    }
  });

  it("gives a new order the full ship-to that oim-api does not send", async () => {
    const db = freshDb();
    server.use(...fakeOimApi(db, { now: LATER, shiftDays: TEST_SHIFT_DAYS }));
    const [first] = placedBetween(db, TEST_NOW, LATER);
    await run(db);
    const columns = "ship_name, ship_address, ship_city, ship_region, ship_postal_code, ship_country";
    expect(one(db, `SELECT ${columns} FROM orders WHERE order_id = ?`, first!)).toEqual(
      one(db, `SELECT ${columns} FROM seed_orders WHERE order_id = ?`, first!),
    );
    expect(one(db, "SELECT ship_name FROM orders WHERE order_id = ?", first!).ship_name).toBeTruthy();
  });

  it("keeps the dashboard rollup equal to the order lines", async () => {
    const db = freshDb();
    server.use(...fakeOimApi(db, { now: LATER, shiftDays: TEST_SHIFT_DAYS }));
    await run(db);
    const lines = one(
      db,
      `SELECT round(sum(round(l.unit_price * l.quantity * (1 - l.discount), 2)), 2) AS r
       FROM order_lines l JOIN orders o USING (order_id) WHERE substr(o.order_date, 1, 7) = '2026-10'`,
    ).r;
    expect(
      one(db, "SELECT round(sum(revenue), 2) AS r FROM product_month_sales WHERE month = '2026-10'").r,
    ).toBe(lines);
  });

  it("records shipments that happened since the last run", async () => {
    const db = freshDb();
    server.use(...fakeOimApi(db, { now: LATER, shiftDays: TEST_SHIFT_DAYS }));
    const shippedSince = Number(
      one(
        db,
        `SELECT count(*) AS n FROM seed_orders s JOIN orders o USING (order_id)
         WHERE o.shipped_date IS NULL AND ${moved("s.shipped_date")} <= ?`,
        LATER,
      ).n,
    );
    expect(shippedSince).toBeGreaterThan(0);

    const result = await run(db);

    expect(result.shipped).toBe(shippedSince);
    expect(one(db, "SELECT shipped_date FROM orders WHERE order_id = 21646").shipped_date).toBeNull();
  });

  it("changes nothing when run twice", async () => {
    const db = freshDb();
    server.use(...fakeOimApi(db, { now: LATER, shiftDays: TEST_SHIFT_DAYS }));
    await run(db);
    const second = await run(db);
    expect(second).toMatchObject({ added: 0, shipped: 0 });
  });

  it("waits and tries again when oim-api says too many requests", async () => {
    const db = freshDb();
    server.use(...fakeOimApi(db, { now: LATER, shiftDays: TEST_SHIFT_DAYS }, { tooManyFirst: true }));
    const result = await run(db);
    expect(result.added).toBeGreaterThan(0);
  });

  it("records when it ran, for the health check", async () => {
    const db = freshDb();
    server.use(...fakeOimApi(db, { now: LATER, shiftDays: TEST_SHIFT_DAYS }));
    await run(db);
    const response = await createApp({ db, now: () => LATER }).request("/api/health");
    const health = schemas.health.parse(await response.json());
    expect(health.last_sync).toBe(LATER);
  });
});
