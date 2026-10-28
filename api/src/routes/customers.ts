import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { notFound, pageQuery, paginate, query, sortQuery, textQuery } from "../http.ts";
import * as schemas from "../schemas.ts";

const SELECT = `
  c.customer_id, c.company_name, c.contact_name, c.contact_title, c.address, c.city, c.region, c.postal_code,
  c.country, c.phone, c.fax,
  coalesce(t.order_count, 0) AS order_count, coalesce(t.revenue, 0) AS revenue_dollars`;

const FROM = `
  customers c
  LEFT JOIN (SELECT customer_id, count(*) AS order_count, round(sum(lines_total), 2) AS revenue
             FROM orders GROUP BY customer_id) t USING (customer_id)`;

const toCustomer = (row: Record<string, unknown>) => schemas.customer.parse(row);

// One source ID is "Val2 ", so IDs match ignoring case and surrounding spaces.
export const SAME_CUSTOMER = "upper(trim(c.customer_id)) = upper(trim(:customer_id))";

export const customers = new Hono<AppEnv>()
  .get(
    "/",
    query({
      ...pageQuery,
      name: textQuery,
      country: textQuery,
      sort: sortQuery(
        {
          customer_id: "c.customer_id",
          company_name: "c.company_name",
          country: "c.country",
          order_count: "order_count",
          revenue: "revenue_dollars",
        },
        "customer_id",
      ),
    }),
    (c) => {
      const q = c.req.valid("query");
      const where: string[] = [];
      if (q.name) where.push("instr(fold(c.company_name), fold(:name)) > 0");
      if (q.country) where.push("fold(c.country) = fold(:country)");
      return c.json(
        paginate(
          c.var.db,
          { select: SELECT, from: FROM, where, orderBy: `${q.sort}, c.customer_id` },
          { name: q.name ?? null, country: q.country ?? null },
          q.page,
          q.per_page,
          toCustomer,
        ),
      );
    },
  )
  .get("/:id", (c) => {
    const id = c.req.param("id");
    const row = c.var.db
      .prepare(`SELECT ${SELECT} FROM ${FROM} WHERE ${SAME_CUSTOMER}`)
      .get({ customer_id: id });
    return row ? c.json(toCustomer(row)) : c.json(notFound(`customer ${id}`), 404);
  });
