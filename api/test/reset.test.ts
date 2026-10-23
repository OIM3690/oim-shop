import { describe, expect, it } from "vitest";
import { resetEnteredData } from "../src/reset.ts";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

function enterOrder(db: ReturnType<typeof freshDb>) {
  db.exec("INSERT INTO users (user_id, github_id, created_at) VALUES (1, 4242, '2026-10-22T10:00:00')");
  db.exec(`INSERT INTO employees (employee_id, first_name, last_name, title, reports_to, hire_date, user_id)
           VALUES (10, 'Ana', '', 'Sales Representative', 5, '2026-10-22', 1)`);
  db.exec(`INSERT INTO orders (order_id, customer_id, employee_id, order_date, required_date, shipper_id, freight,
             ship_city, ship_country, entered_by_user, lines_total, line_count)
           VALUES (1000000, 'ALFKI', 10, '${TEST_NOW}', '2026-11-01T00:00:00', 1, 10, 'Berlin', 'Germany', 1, 180, 1)`);
  db.exec("INSERT INTO order_lines VALUES (1000000, 1, 18, 10, 0)");
  db.exec("UPDATE products SET units_in_stock = units_in_stock - 10 WHERE product_id = 1");
  db.exec(
    "INSERT INTO product_month_sales VALUES (1, '2026-10', 180, 10) ON CONFLICT DO UPDATE SET revenue = revenue + 180, quantity = quantity + 10",
  );
}

describe("nightly reset", () => {
  it("removes entered orders and returns stock to the seed", async () => {
    const db = freshDb();
    const stockBefore = one(db, "SELECT units_in_stock AS s FROM products WHERE product_id = 1").s;
    const ordersBefore = one(db, "SELECT count(*) AS n FROM orders").n;
    const octoberBefore = one(
      db,
      "SELECT revenue FROM product_month_sales WHERE product_id = 1 AND month = '2026-10'",
    ).revenue;
    enterOrder(db);

    const result = resetEnteredData(db);

    expect(result.ordersRemoved).toBe(1);
    expect(one(db, "SELECT count(*) AS n FROM orders").n).toBe(ordersBefore);
    expect(one(db, "SELECT count(*) AS n FROM order_lines WHERE order_id = 1000000").n).toBe(0);
    expect(one(db, "SELECT units_in_stock AS s FROM products WHERE product_id = 1").s).toBe(stockBefore);
    expect(
      one(db, "SELECT revenue FROM product_month_sales WHERE product_id = 1 AND month = '2026-10'").revenue,
    ).toBe(octoberBefore);
  });

  it("keeps accounts, display names and synced orders", async () => {
    const db = freshDb();
    enterOrder(db);
    resetEnteredData(db);
    expect(one(db, "SELECT count(*) AS n FROM users").n).toBe(1);
    expect(one(db, "SELECT first_name FROM employees WHERE employee_id = 10").first_name).toBe("Ana");
    expect(one(db, "SELECT count(*) AS n FROM orders WHERE order_id = 21646").n).toBe(1);
  });
});
