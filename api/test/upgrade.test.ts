// A database that is already live gains the new columns and data on its next
// start, without a reload: accounts, sessions, names, entered orders and
// stock all stay as they were. The test builds a database at the first
// schema version, as the live one was, and opens it with the current code.
import { mkdtempSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, inject, it } from "vitest";
import { openDatabase } from "../src/db.ts";
import { one } from "./helpers.ts";

const FIRST_MIGRATION = "001-schema.sql";

/**
 * A database at schema 001 holding what the seed loader then put in it: the
 * template's rows, limited to the columns 001 has.
 */
function databaseAtFirstVersion() {
  const template = inject("templateDb");
  const path = join(mkdtempSync(join(dirname(template), "upgrade-")), "shop.db");
  // The copy goes table by table, so foreign keys are checked by the upgrade, not here.
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  db.exec(readFileSync(new URL(`../../db/migrations/${FIRST_MIGRATION}`, import.meta.url), "utf8"));
  db.exec("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  db.prepare("INSERT INTO schema_migrations VALUES (?, '2026-10-23T00:00:00Z')").run(FIRST_MIGRATION);
  db.prepare("ATTACH DATABASE ? AS template").run(template);
  const tables = db
    .prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name <> 'schema_migrations'")
    .all()
    .map((r) => String(r.name));
  for (const table of tables) {
    const columns = db
      .prepare("SELECT name FROM pragma_table_info(?)")
      .all(table)
      .map((r) => `"${String(r.name)}"`)
      .join(", ");
    db.exec(`INSERT INTO main.${table} (${columns}) SELECT ${columns} FROM template.${table}`);
  }
  db.exec("DETACH DATABASE template");
  return { db, path, template };
}

describe("upgrading a live database", () => {
  const { db: old, path, template } = databaseAtFirstVersion();

  // What a live database holds besides the seed: an account with a session,
  // the rep's chosen name, and an order the rep entered, which took stock.
  old.exec(`
    INSERT INTO users (user_id, github_id, created_at) VALUES (1, 9001, '2026-10-23T10:00:00');
    INSERT INTO sessions VALUES ('a-session-hash', 1, '2099-01-01T00:00:00Z');
    INSERT INTO employees (employee_id, first_name, last_name, title, reports_to, hire_date, user_id)
      VALUES (10, 'Quillon', '', 'Sales Representative', 5, '2026-10-23', 1);
    INSERT INTO orders (order_id, customer_id, employee_id, order_date, required_date, shipper_id, freight,
        ship_city, ship_country, lines_total, line_count, entered_by_user)
      VALUES (1000000, 'ALFKI', 10, '2026-10-23T10:05:00', '2026-11-01T00:00:00', 1, 12.5, 'Berlin', 'Germany',
        90, 1, 1);
    INSERT INTO order_lines VALUES (1000000, 1, 18, 5, 0);
    UPDATE products SET units_in_stock = units_in_stock - 5 WHERE product_id = 1;
  `);
  const stockBefore = one(old, "SELECT units_in_stock FROM products WHERE product_id = 1").units_in_stock;
  const ordersBefore = one(old, "SELECT count(*) AS n FROM orders").n;
  old.close();

  const db = openDatabase(path);
  db.prepare("ATTACH DATABASE ? AS fresh").run(template);
  const differing = (table: string, columns: string, where = "1") =>
    one(
      db,
      `SELECT count(*) AS n FROM (SELECT ${columns} FROM main.${table} WHERE ${where}
         EXCEPT SELECT ${columns} FROM fresh.${table} WHERE ${where})`,
    ).n;

  it("applies the new migrations", () => {
    const applied = db
      .prepare("SELECT name FROM schema_migrations ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(applied[0]).toBe(FIRST_MIGRATION);
    expect(applied.length).toBeGreaterThan(1);
  });

  it("keeps accounts, sessions, chosen names, entered orders and stock", () => {
    expect(one(db, "SELECT github_id FROM users WHERE user_id = 1").github_id).toBe(9001);
    expect(one(db, "SELECT user_id FROM sessions WHERE token_hash = 'a-session-hash'").user_id).toBe(1);
    expect(one(db, "SELECT first_name, user_id FROM employees WHERE employee_id = 10")).toEqual({
      first_name: "Quillon",
      user_id: 1,
    });
    expect(one(db, "SELECT count(*) AS n FROM order_lines WHERE order_id = 1000000").n).toBe(1);
    expect(one(db, "SELECT count(*) AS n FROM orders").n).toBe(ordersBefore);
    expect(one(db, "SELECT units_in_stock FROM products WHERE product_id = 1").units_in_stock).toBe(
      stockBefore,
    );
  });

  it("fills every new column as a fresh seed would", () => {
    expect(differing("categories", "category_id, picture")).toBe(0);
    expect(
      differing(
        "suppliers",
        "supplier_id, contact_name, contact_title, address, city, region, postal_code, country, phone, fax, home_page",
      ),
    ).toBe(0);
    expect(differing("shippers", "shipper_id, phone")).toBe(0);
    expect(differing("products", "product_id, units_on_order")).toBe(0);
    expect(
      differing("customers", "customer_id, contact_title, address, region, postal_code, phone, fax"),
    ).toBe(0);
    expect(
      differing(
        "employees",
        `employee_id, title_of_courtesy, birth_date, address, region, postal_code, home_phone, extension,
         photo, notes`,
        "user_id IS NULL",
      ),
    ).toBe(0);
    expect(
      differing(
        "orders",
        "order_id, ship_name, ship_address, ship_region, ship_postal_code",
        "order_id < 1000000",
      ),
    ).toBe(0);
    expect(differing("regions", "*")).toBe(0);
    expect(differing("territories", "*")).toBe(0);
    expect(differing("employee_territories", "*")).toBe(0);
    expect(one(db, "SELECT count(*) AS n FROM territories").n).toBe(53);
  });

  it("ships an entered order to its customer's name and full address", () => {
    expect(
      one(
        db,
        `SELECT ship_name, ship_address, ship_city, ship_region, ship_postal_code, ship_country
         FROM orders WHERE order_id = 1000000`,
      ),
    ).toEqual({
      ship_name: "Alfreds Futterkiste",
      ship_address: "Obere Str. 57",
      ship_city: "Berlin",
      ship_region: "Western Europe",
      ship_postal_code: "12209",
      ship_country: "Germany",
    });
  });

  it("does it once: a later start changes nothing", () => {
    db.exec("DETACH DATABASE fresh");
    db.exec("UPDATE customers SET phone = 'changed later' WHERE customer_id = 'ALFKI'");
    db.close();
    const again = openDatabase(path);
    expect(one(again, "SELECT phone FROM customers WHERE customer_id = 'ALFKI'").phone).toBe("changed later");
    again.close();
  });
});
