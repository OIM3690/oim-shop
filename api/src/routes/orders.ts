import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { bool, notFound, pageQuery, paginate, query, sortQuery, textQuery } from "../http.ts";
import * as schemas from "../schemas.ts";
import { SAME_CUSTOMER } from "./customers.ts";

export const ORDER_SELECT = `
  o.order_id, o.customer_id, c.company_name AS customer_name, o.order_date, o.required_date, o.shipped_date,
  o.shipper_id, s.name AS shipper, s.phone AS shipper_phone, o.ship_name, o.ship_address, o.ship_city,
  o.ship_region, o.ship_postal_code, o.ship_country, o.freight AS freight_dollars, o.line_count,
  o.lines_total AS order_total_dollars, o.employee_id, trim(e.first_name || ' ' || e.last_name) AS employee_name,
  o.entered_by_user IS NOT NULL AS entered`;

export const ORDER_FROM = `
  orders o
  JOIN customers c USING (customer_id)
  JOIN employees e USING (employee_id)
  JOIN shippers s USING (shipper_id)`;

export const toOrderSummary = (row: Record<string, unknown>) =>
  schemas.orderSummary.parse({ ...row, entered: bool(row.entered) });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
  .optional();

export const orderListQuery = {
  ...pageQuery,
  customer_id: textQuery,
  employee_id: z.coerce.number().int().positive().optional(),
  country: textQuery,
  from_date: isoDate,
  to_date: isoDate,
  sort: sortQuery(
    {
      order_date: "o.order_date",
      order_total: "o.lines_total",
      customer: "c.company_name",
      order_id: "o.order_id",
    },
    "-order_date",
  ),
};

/** The WHERE clauses and parameters for the order filters, shared with "my orders". */
export function orderFilters(q: {
  customer_id?: string;
  employee_id?: number;
  country?: string;
  from_date?: string;
  to_date?: string;
}) {
  const where: string[] = [];
  if (q.customer_id) where.push(SAME_CUSTOMER.replaceAll("c.customer_id", "o.customer_id"));
  if (q.employee_id) where.push("o.employee_id = :employee_id");
  if (q.country) where.push("fold(o.ship_country) = fold(:country)");
  // Both days are included, as on oim-api.
  if (q.from_date) where.push("o.order_date >= :from_date || 'T00:00:00'");
  if (q.to_date) where.push("o.order_date <= :to_date || 'T23:59:59'");
  const params = {
    customer_id: q.customer_id ?? null,
    employee_id: q.employee_id ?? null,
    country: q.country ?? null,
    from_date: q.from_date ?? null,
    to_date: q.to_date ?? null,
  };
  return { where, params };
}

const LINES = `
  SELECT l.product_id, p.name AS product_name, l.unit_price AS unit_price_dollars, l.quantity,
    l.discount AS discount_fraction, round(l.unit_price * l.quantity * (1 - l.discount), 2) AS line_total_dollars
  FROM order_lines l JOIN products p USING (product_id)
  WHERE l.order_id = ? ORDER BY l.product_id`;

export function readOrder(db: AppEnv["Variables"]["db"], orderId: number) {
  const row = db.prepare(`SELECT ${ORDER_SELECT} FROM ${ORDER_FROM} WHERE o.order_id = ?`).get(orderId);
  if (!row) return undefined;
  const lines = db.prepare(LINES).all(orderId);
  return schemas.order.parse({ ...toOrderSummary(row), lines });
}

export const orders = new Hono<AppEnv>()
  .get("/", query(orderListQuery), (c) => {
    const q = c.req.valid("query");
    const { where, params } = orderFilters(q);
    return c.json(
      paginate(
        c.var.db,
        { select: ORDER_SELECT, from: ORDER_FROM, where, orderBy: `${q.sort}, o.order_id DESC` },
        params,
        q.page,
        q.per_page,
        toOrderSummary,
      ),
    );
  })
  .get("/:id{[0-9]+}", (c) => {
    const found = readOrder(c.var.db, Number(c.req.param("id")));
    return found ? c.json(found) : c.json(notFound(`order ${c.req.param("id")}`), 404);
  });
