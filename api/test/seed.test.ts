import { describe, expect, it } from "vitest";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

describe("seed", () => {
  const db = freshDb();

  it("loads the reference tables whole", () => {
    expect(one(db, "SELECT count(*) AS n FROM products").n).toBe(77);
    expect(one(db, "SELECT count(*) AS n FROM customers").n).toBe(93);
    expect(one(db, "SELECT count(*) AS n FROM employees").n).toBe(9);
  });

  it("moves every date onto oim-api's clock", () => {
    // Order 10248 is dated 2016-07-04 in the source; oim-api shows 2020-03-06.
    const order = one(
      db,
      "SELECT order_date, required_date, shipped_date FROM orders WHERE order_id = 10248",
    );
    expect(order).toEqual({
      order_date: "2020-03-06T00:00:00",
      required_date: "2020-04-03T00:00:00",
      shipped_date: "2020-03-18T00:00:00",
    });
    // Nancy Davolio was hired 2012-05-01 in the source; oim-api shows 2016-01-02.
    expect(one(db, "SELECT hire_date FROM employees WHERE employee_id = 1").hire_date).toBe("2016-01-02");
  });

  it("keeps only the orders placed by now", () => {
    expect(one(db, "SELECT max(order_date) AS d FROM orders").d! <= TEST_NOW).toBe(true);
    const kept = one(db, "SELECT count(*) AS n FROM orders").n as number;
    const all = one(db, "SELECT count(*) AS n FROM seed_orders").n as number;
    expect(kept).toBeGreaterThan(15000);
    expect(kept).toBeLessThan(all);
    expect(
      one(
        db,
        "SELECT count(*) AS n FROM order_lines l LEFT JOIN orders o USING (order_id) WHERE o.order_id IS NULL",
      ).n,
    ).toBe(0);
  });

  it("leaves a shipment that is still in the future unshipped", () => {
    // Order 21646 was placed at 14:59 on the test day and ships later.
    expect(one(db, "SELECT shipped_date FROM orders WHERE order_id = 21646").shipped_date).toBeNull();
    expect(one(db, "SELECT count(*) AS n FROM orders WHERE shipped_date > ?", TEST_NOW).n).toBe(0);
  });

  it("stores each order's lines total, as oim-api reports it", () => {
    expect(one(db, "SELECT lines_total, line_count FROM orders WHERE order_id = 10248")).toEqual({
      lines_total: 440,
      line_count: 3,
    });
    expect(one(db, "SELECT lines_total FROM orders WHERE order_id = 21646").lines_total).toBe(2743.65);
  });

  it("builds monthly product revenue that adds up to every line", () => {
    // Each line is rounded to the cent first, as oim-api's line_total_dollars is.
    const fromLines = one(
      db,
      "SELECT round(sum(round(unit_price * quantity * (1 - discount), 2)), 2) AS r FROM order_lines",
    ).r;
    const fromRollup = one(db, "SELECT round(sum(revenue), 2) AS r FROM product_month_sales").r;
    expect(fromRollup).toBe(fromLines);
  });
});
