// Reading data/seed into the seed_* tables, and copying the descriptive
// columns from there into the app's tables. The seed loader uses both for a
// new database; a database seeded before migration 002 uses them once, on
// its next start, to gain the columns that migration added.
import { readFileSync } from "node:fs";
import { DEFAULT_SHIFT_DAYS } from "./clock.ts";
import type { Database } from "./db.ts";

const SEED = new URL("../../data/seed/", import.meta.url);

/** The seed files, in an order that satisfies the foreign keys between the app's tables. */
export const SEED_TABLES = [
  "categories",
  "suppliers",
  "shippers",
  "products",
  "customers",
  "employees",
  "orders",
  "order_lines",
  "regions",
  "territories",
  "employee_territories",
];

/** Replaces the rows of the given seed_* tables with the seed files' rows. */
export function loadSeedFiles(db: Database, tables: string[]) {
  for (const table of tables) {
    db.exec(`DELETE FROM seed_${table}`);
    db.exec(readFileSync(new URL(`${table}.sql`, SEED), "utf8"));
  }
}

/**
 * An Access hyperlink is stored as "text#address#". Keeps the address when it
 * is a web address; the source's other links point into the Access database.
 */
export function hyperlinkAddress(text: string | null): string | null {
  const address = text?.split("#")[1] ?? "";
  return /^https?:\/\//.test(address) ? address : null;
}

/**
 * Copies every column the app shows but never changes from the seed_* tables
 * into the app's tables. It leaves alone what the app does change: stock,
 * accounts, reps, and the orders reps entered, which ship to their
 * customer's address. Running it twice gives the same result.
 */
export function fillDetails(db: Database, shiftDays: number) {
  const shift = `'+${Math.trunc(shiftDays)} days'`;
  db.exec(`
    UPDATE categories SET picture = s.picture FROM seed_categories s WHERE s.category_id = categories.category_id;
    UPDATE suppliers SET contact_name = s.contact_name, contact_title = s.contact_title, address = s.address,
        city = s.city, region = s.region, postal_code = s.postal_code, country = s.country, phone = s.phone,
        fax = s.fax
      FROM seed_suppliers s WHERE s.supplier_id = suppliers.supplier_id;
    UPDATE shippers SET phone = s.phone FROM seed_shippers s WHERE s.shipper_id = shippers.shipper_id;
    UPDATE products SET units_on_order = s.units_on_order
      FROM seed_products s WHERE s.product_id = products.product_id;
    UPDATE customers SET contact_title = s.contact_title, address = s.address, region = s.region,
        postal_code = s.postal_code, phone = s.phone, fax = s.fax
      FROM seed_customers s WHERE s.customer_id = customers.customer_id;
    UPDATE employees SET title_of_courtesy = s.title_of_courtesy, birth_date = date(s.birth_date, ${shift}),
        address = s.address, region = s.region, postal_code = s.postal_code, home_phone = s.home_phone,
        extension = s.extension, photo = s.photo, notes = s.notes
      FROM seed_employees s WHERE s.employee_id = employees.employee_id AND employees.user_id IS NULL;
    UPDATE orders SET ship_name = s.ship_name, ship_address = s.ship_address, ship_region = s.ship_region,
        ship_postal_code = s.ship_postal_code
      FROM seed_orders s WHERE s.order_id = orders.order_id AND orders.entered_by_user IS NULL;
    UPDATE orders SET ship_name = c.company_name, ship_address = c.address, ship_city = c.city,
        ship_region = c.region, ship_postal_code = c.postal_code, ship_country = c.country
      FROM customers c WHERE c.customer_id = orders.customer_id AND orders.entered_by_user IS NOT NULL;

    DELETE FROM employee_territories;
    DELETE FROM territories;
    DELETE FROM regions;
    INSERT INTO regions SELECT region_id, name FROM seed_regions;
    INSERT INTO territories SELECT territory_id, name, region_id FROM seed_territories;
    INSERT INTO employee_territories SELECT employee_id, territory_id FROM seed_employee_territories;
  `);
  const homePage = db.prepare("UPDATE suppliers SET home_page = ? WHERE supplier_id = ?");
  for (const row of db.prepare("SELECT supplier_id, home_page FROM seed_suppliers").all()) {
    homePage.run(
      hyperlinkAddress(row.home_page === null ? null : String(row.home_page)),
      Number(row.supplier_id),
    );
  }
}

/**
 * Runs after migration 002, inside its transaction. A database that was
 * seeded already reads the seed files again (all but the 600,000 order
 * lines, which have not changed) and fills the new columns. A new, empty
 * database has nothing to fill; the seed loader does it.
 */
export function upgradeSeededDatabase(db: Database) {
  if (!db.prepare("SELECT 1 FROM seed_orders LIMIT 1").get()) return;
  loadSeedFiles(
    db,
    SEED_TABLES.filter((table) => table !== "order_lines"),
  );
  const shift = db.prepare("SELECT value FROM app_state WHERE key = 'clock_shift_days'").get();
  fillDetails(db, shift ? Number(shift.value) : DEFAULT_SHIFT_DAYS);
}
