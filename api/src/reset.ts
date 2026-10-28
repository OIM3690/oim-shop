// The nightly reset. Orders entered in the app, and every product's stock,
// go back to their seeded state. Accounts and display names stay, and so do
// the orders sync brought in from oim-api.
import { transaction, type Database } from "./db.ts";
import { refreshProductMonthSales } from "./totals.ts";

export function resetEnteredData(db: Database) {
  return transaction(db, () => removeEnteredOrders(db));
}

/** The reset's work, for a caller that already holds a transaction. */
export function removeEnteredOrders(db: Database) {
  const months = db
    .prepare(
      "SELECT DISTINCT substr(order_date, 1, 7) AS month FROM orders WHERE entered_by_user IS NOT NULL",
    )
    .all()
    .map((row) => String(row.month));
  const removed = db.prepare("DELETE FROM orders WHERE entered_by_user IS NOT NULL").run().changes;
  db.exec(`UPDATE products SET units_in_stock = (SELECT s.units_in_stock FROM seed_products s
             WHERE s.product_id = products.product_id)`);
  refreshProductMonthSales(db, months);
  return { ordersRemoved: Number(removed) };
}
