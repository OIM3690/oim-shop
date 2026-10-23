import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { as, fakeGitHub, signIn } from "./auth-helpers.ts";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

const server = setupServer(...fakeGitHub({ alice: 1001, bob: 1002, carol: 1003 }));
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function setup() {
  const db = freshDb();
  const app = createApp({ db, now: () => TEST_NOW, github: { clientId: "c", clientSecret: "s" } });
  const rep = async (code: string, name: string) => {
    const { cookie } = await signIn(app, code);
    await app.request("/api/me", as(cookie, { method: "PUT", json: { display_name: name } }));
    return cookie;
  };
  return { db, app, alice: await rep("alice", "Ana"), bob: await rep("bob", "Ben") };
}

const stock = (db: ReturnType<typeof freshDb>, productId: number) =>
  Number(one(db, "SELECT units_in_stock AS s FROM products WHERE product_id = ?", productId).s);

// Chai (1) and Chang (2) are on sale; Alice Mutton (17) is discontinued.
const valid = {
  customer_id: "ALFKI",
  shipper_id: 1,
  required_date: "2026-11-05",
  freight: 12.5,
  lines: [
    { product_id: 1, quantity: 10, discount: 0 },
    { product_id: 2, quantity: 5, discount: 0.1 },
  ],
};

async function place(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, body: unknown = valid) {
  const response = await app.request("/api/orders", as(cookie, { method: "POST", json: body }));
  const json = await response.json();
  return { status: response.status, json };
}

describe("entering an order", () => {
  it("writes the order, its lines and the stock change, with prices from the catalog", async () => {
    const { db, app, alice } = await setup();
    const chai = stock(db, 1);
    const { status, json } = await place(app, alice);

    expect(status).toBe(201);
    const order = schemas.order.parse(json);
    expect(order.order_id).toBeGreaterThanOrEqual(1_000_000);
    expect(order).toMatchObject({
      customer_id: "ALFKI",
      employee_name: "Ana",
      shipped_date: null,
      entered: true,
    });
    expect(order.order_date).toBe(TEST_NOW);
    expect(order.lines.map((l) => [l.product_id, l.unit_price_dollars, l.line_total_dollars])).toEqual([
      [1, 18, 180],
      [2, 19, 85.5],
    ]);
    expect(order.order_total_dollars).toBe(265.5);
    expect(stock(db, 1)).toBe(chai - 10);
  });

  it("shows up at once on the dashboard and in the customer's revenue", async () => {
    const { app, alice } = await setup();
    const before = schemas.dashboard.parse(await (await app.request("/api/dashboard")).json());
    const customerBefore = schemas.customer.parse(await (await app.request("/api/customers/ALFKI")).json());
    await place(app, alice);
    const after = schemas.dashboard.parse(await (await app.request("/api/dashboard")).json());
    const customerAfter = schemas.customer.parse(await (await app.request("/api/customers/ALFKI")).json());

    expect(Math.round((after.totals.revenue_dollars - before.totals.revenue_dollars) * 100)).toBe(26550);
    expect(after.totals.order_count - before.totals.order_count).toBe(1);
    expect(Math.round((customerAfter.revenue_dollars - customerBefore.revenue_dollars) * 100)).toBe(26550);
    expect(after.by_employee.find((e) => e.name === "Ana")?.revenue_dollars).toBe(265.5);
  });

  it("needs a signed-in rep with a display name", async () => {
    const { app } = await setup();
    expect((await app.request("/api/orders", as("", { method: "POST", json: valid }))).status).toBe(401);
    const { cookie } = await signIn(app, "carol");
    expect((await app.request("/api/orders", as(cookie, { method: "POST", json: valid }))).status).toBe(403);
  });
});

describe("order rules", () => {
  const cases: [string, unknown][] = [
    ["a discontinued product", { ...valid, lines: [{ product_id: 17, quantity: 1, discount: 0 }] }],
    ["a quantity of zero", { ...valid, lines: [{ product_id: 1, quantity: 0, discount: 0 }] }],
    [
      "a quantity that is not a whole number",
      { ...valid, lines: [{ product_id: 1, quantity: 1.5, discount: 0 }] },
    ],
    ["more than is in stock", { ...valid, lines: [{ product_id: 1, quantity: 100000, discount: 0 }] }],
    ["a discount above 25%", { ...valid, lines: [{ product_id: 1, quantity: 1, discount: 0.3 }] }],
    ["a negative discount", { ...valid, lines: [{ product_id: 1, quantity: 1, discount: -0.1 }] }],
    [
      "the same product twice",
      {
        ...valid,
        lines: [
          { product_id: 1, quantity: 1, discount: 0 },
          { product_id: 1, quantity: 2, discount: 0 },
        ],
      },
    ],
    [
      "a price set by the browser",
      { ...valid, lines: [{ product_id: 1, quantity: 1, discount: 0, unit_price: 0.01 }] },
    ],
    ["a required date that is not after today", { ...valid, required_date: "2026-10-22" }],
    ["no lines", { ...valid, lines: [] }],
    ["an order date set by the browser", { ...valid, order_date: "2020-01-01" }],
    ["an unknown customer", { ...valid, customer_id: "NOPE" }],
    ["an unknown product", { ...valid, lines: [{ product_id: 999, quantity: 1, discount: 0 }] }],
    ["an unknown shipper", { ...valid, shipper_id: 9 }],
  ];

  it.each(cases)("refuses %s, and writes nothing", async (_, body) => {
    const { db, app, alice } = await setup();
    // Alice Mutton is out of stock as well as discontinued; give it stock so
    // only the discontinued rule can refuse it.
    db.exec("UPDATE products SET units_in_stock = 50 WHERE product_id = 17");
    const orders = one(db, "SELECT count(*) AS n FROM orders").n;
    const chai = stock(db, 1);
    const { status, json } = await place(app, alice, body);
    expect(status).toBe(422);
    const refusal = z.object({ detail: z.array(z.string()).min(1) }).safeParse(json);
    expect(refusal.success).toBe(true);
    expect(one(db, "SELECT count(*) AS n FROM orders").n).toBe(orders);
    expect(stock(db, 1)).toBe(chai);
  });

  it("leaves no partial order when a later line fails", async () => {
    const { db, app, alice } = await setup();
    const chai = stock(db, 1);
    const body = {
      ...valid,
      lines: [
        { product_id: 1, quantity: 1, discount: 0 },
        { product_id: 2, quantity: 100000, discount: 0 },
      ],
    };
    expect((await place(app, alice, body)).status).toBe(422);
    expect(stock(db, 1)).toBe(chai);
    expect(one(db, "SELECT count(*) AS n FROM orders WHERE entered_by_user IS NOT NULL").n).toBe(0);
  });
});

describe("changing an order", () => {
  it("edits an unshipped order and moves stock by the difference", async () => {
    const { db, app, alice } = await setup();
    const placed = schemas.order.parse((await place(app, alice)).json);
    const chai = stock(db, 1);
    const chang = stock(db, 2);
    const body = { ...valid, lines: [{ product_id: 1, quantity: 4, discount: 0 }] };

    const response = await app.request(
      `/api/orders/${placed.order_id}`,
      as(alice, { method: "PUT", json: body }),
    );

    expect(response.status).toBe(200);
    const edited = schemas.order.parse(await response.json());
    expect(edited.lines).toHaveLength(1);
    expect(edited.order_total_dollars).toBe(72);
    expect(stock(db, 1)).toBe(chai + 6);
    expect(stock(db, 2)).toBe(chang + 5);
  });

  it("allows using stock this order already holds", async () => {
    const { db, app, alice } = await setup();
    const all = stock(db, 2);
    const placed = schemas.order.parse(
      (await place(app, alice, { ...valid, lines: [{ product_id: 2, quantity: all, discount: 0 }] })).json,
    );
    const body = { ...valid, lines: [{ product_id: 2, quantity: all, discount: 0.05 }] };
    expect(
      (await app.request(`/api/orders/${placed.order_id}`, as(alice, { method: "PUT", json: body }))).status,
    ).toBe(200);
  });

  it("cancels an unshipped order and returns its stock", async () => {
    const { db, app, alice } = await setup();
    const chai = stock(db, 1);
    const placed = schemas.order.parse((await place(app, alice)).json);
    const response = await app.request(
      `/api/orders/${placed.order_id}/cancel`,
      as(alice, { method: "POST" }),
    );
    expect(response.status).toBe(204);
    expect(stock(db, 1)).toBe(chai);
    expect((await app.request(`/api/orders/${placed.order_id}`)).status).toBe(404);
  });

  it("marks an order shipped, after which it can no longer change", async () => {
    const { app, alice } = await setup();
    const placed = schemas.order.parse((await place(app, alice)).json);
    const shipped = await app.request(`/api/orders/${placed.order_id}/ship`, as(alice, { method: "POST" }));
    expect(schemas.order.parse(await shipped.json()).shipped_date).toBe(TEST_NOW);
    expect(
      (await app.request(`/api/orders/${placed.order_id}`, as(alice, { method: "PUT", json: valid }))).status,
    ).toBe(409);
    expect(
      (await app.request(`/api/orders/${placed.order_id}/cancel`, as(alice, { method: "POST" }))).status,
    ).toBe(409);
  });

  it("refuses to change another rep's order, or a Northwind order", async () => {
    const { db, app, alice, bob } = await setup();
    const placed = schemas.order.parse((await place(app, alice)).json);
    for (const [path, init] of [
      [`/api/orders/${placed.order_id}`, { method: "PUT", json: valid }],
      [`/api/orders/${placed.order_id}/cancel`, { method: "POST" }],
      [`/api/orders/${placed.order_id}/ship`, { method: "POST" }],
      ["/api/orders/21646/cancel", { method: "POST" }],
    ] as const) {
      expect((await app.request(path, as(bob, init))).status).toBe(404);
    }
    expect(one(db, "SELECT count(*) AS n FROM orders WHERE order_id = ?", placed.order_id).n).toBe(1);
  });

  it("lists your own orders", async () => {
    const { app, alice, bob } = await setup();
    await place(app, alice);
    await place(app, alice);
    await place(app, bob);
    const mine = schemas
      .pageOf(schemas.orderSummary)
      .parse(await (await app.request("/api/me/orders", as(alice))).json());
    expect(mine.pagination.total).toBe(2);
    expect(mine.items.every((o) => o.employee_name === "Ana")).toBe(true);
  });
});
