// Two kinds of derived numbers are stored so that reading them is cheap: each
// order's lines_total and line_count, and revenue per product per month in
// product_month_sales. Every write to order_lines calls these afterwards,
// inside the same transaction.
import type { Database } from "./db.ts";

const LINE_TOTAL = "round(l.unit_price * l.quantity * (1 - l.discount), 2)";

/** Recomputes lines_total and line_count for the given orders, or for every order. */
export function refreshOrderTotals(db: Database, orderIds?: number[]) {
  const only = orderIds ? `WHERE order_id IN (${orderIds.map(Number).join(",") || "NULL"})` : "";
  db.exec(`
    UPDATE orders SET
      lines_total = coalesce((SELECT round(sum(${LINE_TOTAL}), 2) FROM order_lines l WHERE l.order_id = orders.order_id), 0),
      line_count = (SELECT count(*) FROM order_lines l WHERE l.order_id = orders.order_id)
    ${only}`);
}

/** Rebuilds product_month_sales, entirely or for the months the given orders fall in. */
export function refreshProductMonthSales(db: Database, months?: string[]) {
  const monthList = months?.map((m) => `'${m.replace(/[^0-9-]/g, "")}'`).join(",");
  const where = months ? `WHERE substr(o.order_date, 1, 7) IN (${monthList || "NULL"})` : "";
  db.exec(
    months
      ? `DELETE FROM product_month_sales WHERE month IN (${monthList || "NULL"})`
      : "DELETE FROM product_month_sales",
  );
  db.exec(`
    INSERT INTO product_month_sales (product_id, month, revenue, quantity)
    SELECT l.product_id, substr(o.order_date, 1, 7), round(sum(${LINE_TOTAL}), 2), sum(l.quantity)
    FROM order_lines l JOIN orders o USING (order_id)
    ${where}
    GROUP BY 1, 2`);
}

/** The months ("YYYY-MM") the given orders were placed in. */
export function monthsOf(db: Database, orderIds: number[]): string[] {
  if (orderIds.length === 0) return [];
  return db
    .prepare(
      `SELECT DISTINCT substr(order_date, 1, 7) AS month FROM orders WHERE order_id IN (${orderIds.map(Number).join(",")})`,
    )
    .all()
    .map((row) => String(row.month));
}
