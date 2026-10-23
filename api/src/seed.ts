// Fills the database from data/seed, moved onto oim-api's shifted clock:
// every date moves forward by shiftDays, only the orders placed by `now` are
// kept, and a shipment dated after `now` has not happened yet.
import { readFileSync } from "node:fs";
import { transaction, type Database } from "./db.ts";
import { refreshOrderTotals, refreshProductMonthSales } from "./totals.ts";

const SEED = new URL("../../data/seed/", import.meta.url);
const TABLES = [
  "categories",
  "suppliers",
  "shippers",
  "products",
  "customers",
  "employees",
  "orders",
  "order_lines",
];

export interface SeedOptions {
  shiftDays: number;
  /** Boston time as "YYYY-MM-DDTHH:MM:SS". */
  now: string;
}

export function loadSeed(db: Database, { shiftDays, now }: SeedOptions) {
  const shift = `'+${Math.trunc(shiftDays)} days'`;
  const moved = (column: string) => `strftime('%Y-%m-%dT%H:%M:%S', ${column}, ${shift})`;

  transaction(db, () => {
    for (const table of [...TABLES].reverse()) {
      db.exec(`DELETE FROM ${table}; DELETE FROM seed_${table};`);
    }
    db.exec("DELETE FROM sessions; DELETE FROM users; DELETE FROM product_month_sales;");
    for (const table of TABLES) db.exec(readFileSync(new URL(`${table}.sql`, SEED), "utf8"));

    db.exec(`
      INSERT INTO categories SELECT * FROM seed_categories;
      INSERT INTO suppliers SELECT * FROM seed_suppliers;
      INSERT INTO shippers SELECT * FROM seed_shippers;
      INSERT INTO products SELECT * FROM seed_products;
      INSERT INTO customers SELECT * FROM seed_customers;
      INSERT INTO employees (employee_id, first_name, last_name, title, reports_to, hire_date, city, country)
        SELECT employee_id, first_name, last_name, title, reports_to, date(hire_date, ${shift}), city, country
        FROM seed_employees;
    `);
    db.prepare(
      `INSERT INTO orders (order_id, customer_id, employee_id, order_date, required_date, shipped_date,
         shipper_id, freight, ship_city, ship_country)
       SELECT order_id, customer_id, employee_id, ${moved("order_date")}, ${moved("required_date")},
         CASE WHEN ${moved("shipped_date")} <= :now THEN ${moved("shipped_date")} END,
         shipper_id, freight, ship_city, ship_country
       FROM seed_orders WHERE ${moved("order_date")} <= :now`,
    ).run({ now });
    db.exec("INSERT INTO order_lines SELECT l.* FROM seed_order_lines l JOIN orders USING (order_id)");
    db.prepare(
      "INSERT OR REPLACE INTO app_state (key, value) VALUES ('clock_shift_days', ?), ('seeded_at', ?)",
    ).run(String(shiftDays), now);

    refreshOrderTotals(db);
    refreshProductMonthSales(db);
  });
}
