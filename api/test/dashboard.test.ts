// Every figure on the dashboard comes from the stored rollups. Each test
// computes the same figure a second way, straight from order_lines, so a
// rollup that drifts from the lines fails here.
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { freshDb, TEST_NOW } from "./helpers.ts";

const db = freshDb();
const app = createApp({ db, now: () => TEST_NOW });
const dashboard = async (query = "") => {
  const response = await app.request(`/api/dashboard${query}`);
  return { status: response.status, body: schemas.dashboard.parse(await response.json()) };
};

const LINE = "round(l.unit_price * l.quantity * (1 - l.discount), 2)";
const inRange = "substr(o.order_date, 1, 7) BETWEEN :from AND :to";
const raw = (sql: string, from: string, to: string) => db.prepare(sql).all({ from, to });
const cents = (n: unknown) => Math.round(Number(n) * 100);

describe("dashboard", () => {
  it("covers the last twelve months by default", async () => {
    const { body } = await dashboard();
    expect(body.from).toBe("2025-11");
    expect(body.to).toBe("2026-10");
    expect(body.revenue_by_month.map((m) => m.month)).toHaveLength(12);
  });

  it("matches the order lines month by month", async () => {
    const { body } = await dashboard("?from=2025-01&to=2026-10");
    const expected = raw(
      `SELECT substr(o.order_date, 1, 7) AS month, sum(${LINE}) AS revenue
       FROM order_lines l JOIN orders o USING (order_id) WHERE ${inRange} GROUP BY 1 ORDER BY 1`,
      "2025-01",
      "2026-10",
    );
    expect(body.revenue_by_month.map((m) => [m.month, cents(m.revenue_dollars)])).toEqual(
      expected.map((r) => [r.month, cents(r.revenue)]),
    );
  });

  it("matches the order lines for the top products", async () => {
    const { body } = await dashboard("?from=2026-01&to=2026-10");
    const expected = raw(
      `SELECT l.product_id, sum(${LINE}) AS revenue, sum(l.quantity) AS quantity
       FROM order_lines l JOIN orders o USING (order_id) WHERE ${inRange}
       GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      "2026-01",
      "2026-10",
    );
    expect(body.top_products.map((p) => [p.product_id, cents(p.revenue_dollars), p.quantity])).toEqual(
      expected.map((r) => [r.product_id, cents(r.revenue), r.quantity]),
    );
  });

  it("matches the order lines by employee and by country, with order counts", async () => {
    const { body } = await dashboard("?from=2026-01&to=2026-10");
    const byEmployee = raw(
      `SELECT o.employee_id, sum(${LINE}) AS revenue, count(DISTINCT o.order_id) AS orders
       FROM order_lines l JOIN orders o USING (order_id) WHERE ${inRange} GROUP BY 1 ORDER BY 2 DESC`,
      "2026-01",
      "2026-10",
    );
    expect(body.by_employee.map((e) => [e.employee_id, cents(e.revenue_dollars), e.order_count])).toEqual(
      byEmployee.map((r) => [r.employee_id, cents(r.revenue), r.orders]),
    );
    const byCountry = raw(
      `SELECT o.ship_country AS country, sum(${LINE}) AS revenue
       FROM order_lines l JOIN orders o USING (order_id) WHERE ${inRange} GROUP BY 1 ORDER BY 2 DESC`,
      "2026-01",
      "2026-10",
    );
    expect(body.by_country.map((c) => [c.country, cents(c.revenue_dollars)])).toEqual(
      byCountry.map((r) => [r.country, cents(r.revenue)]),
    );
    const total = byCountry.reduce((sum, r) => sum + Number(r.revenue), 0);
    expect(cents(body.totals.revenue_dollars)).toBe(Math.round(total * 100));
  });

  it("fills a month with no orders with zero", async () => {
    const { body } = await dashboard("?from=2027-01&to=2027-02");
    expect(body.revenue_by_month).toEqual([
      { month: "2027-01", revenue_dollars: 0, order_count: 0 },
      { month: "2027-02", revenue_dollars: 0, order_count: 0 },
    ]);
  });

  it("refuses a range that is backwards, malformed or too long", async () => {
    for (const query of [
      "?from=2026-05&to=2026-01",
      "?from=2026-13&to=2026-14",
      "?from=1990-01&to=2026-01",
    ]) {
      expect((await app.request(`/api/dashboard${query}`)).status).toBe(400);
    }
  });
});
