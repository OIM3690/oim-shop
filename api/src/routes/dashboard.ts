// Sales for a range of whole months. Revenue by month, employee and country
// adds up each order's stored lines_total (about 16,000 orders); top products
// read the monthly rollup in product_month_sales (about 10,000 rows). Neither
// touches the 600,000 order lines.
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { query, usedBy } from "../http.ts";
import * as schemas from "../schemas.ts";

const MAX_MONTHS = 120;
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM");

const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthName = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

export const dashboard = new Hono<AppEnv>().get(
  "/",
  query({ from: month.optional(), to: month.optional() }),
  (c) => {
    const q = c.req.valid("query");
    const to = q.to ?? c.var.now().slice(0, 7);
    const from = q.from ?? monthName(monthIndex(to) - 11);
    const span = monthIndex(to) - monthIndex(from) + 1;
    if (span < 1) return c.json({ detail: ["from: must not be after to"] }, 400);
    if (span > MAX_MONTHS)
      return c.json({ detail: [`from: the range can cover at most ${MAX_MONTHS} months`] }, 400);

    const db = c.var.db;
    const params = { from, to };
    const all = (sql: string) => db.prepare(sql).all(usedBy(sql, params));
    const inRange = "substr(o.order_date, 1, 7) BETWEEN :from AND :to";

    const months = new Map(
      all(`SELECT substr(o.order_date, 1, 7) AS month, round(sum(o.lines_total), 2) AS revenue_dollars,
             count(*) AS order_count
           FROM orders o WHERE ${inRange} GROUP BY 1`).map((r) => [String(r.month), r]),
    );
    const revenueByMonth = Array.from({ length: span }, (_, i) => {
      const name = monthName(monthIndex(from) + i);
      const row = months.get(name);
      return {
        month: name,
        revenue_dollars: Number(row?.revenue_dollars ?? 0),
        order_count: Number(row?.order_count ?? 0),
      };
    });

    const body = {
      from,
      to,
      totals: {
        revenue_dollars:
          Math.round(revenueByMonth.reduce((sum, m) => sum + m.revenue_dollars, 0) * 100) / 100,
        order_count: revenueByMonth.reduce((sum, m) => sum + m.order_count, 0),
      },
      revenue_by_month: revenueByMonth,
      top_products: all(
        `SELECT s.product_id, p.name, round(sum(s.revenue), 2) AS revenue_dollars, sum(s.quantity) AS quantity
         FROM product_month_sales s JOIN products p USING (product_id)
         WHERE s.month BETWEEN :from AND :to
         GROUP BY s.product_id ORDER BY revenue_dollars DESC, s.product_id LIMIT 10`,
      ),
      by_employee: all(
        `SELECT o.employee_id, trim(e.first_name || ' ' || e.last_name) AS name,
           round(sum(o.lines_total), 2) AS revenue_dollars, count(*) AS order_count
         FROM orders o JOIN employees e USING (employee_id) WHERE ${inRange}
         GROUP BY o.employee_id ORDER BY revenue_dollars DESC, o.employee_id`,
      ),
      by_country: all(
        `SELECT o.ship_country AS country, round(sum(o.lines_total), 2) AS revenue_dollars, count(*) AS order_count
         FROM orders o WHERE ${inRange} AND o.ship_country IS NOT NULL
         GROUP BY o.ship_country ORDER BY revenue_dollars DESC, o.ship_country`,
      ),
    };
    return c.json(schemas.dashboard.parse(body));
  },
);
