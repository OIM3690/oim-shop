// A stand-in for oim-api's /shop, answered from this database's own seed
// tables on a clock that has moved on to `now`. It pages, filters and shapes
// orders the way the real API does, so sync can be tested without the network.
import { http, HttpResponse } from "msw";
import type { Database } from "../src/db.ts";

export const OIM_API = "https://oim.zhili.dev/shop";

export function fakeOimApi(
  db: Database,
  clock: { now: string; shiftDays: number },
  options: { tooManyFirst?: boolean } = {},
) {
  const moved = (column: string) => `strftime('%Y-%m-%dT%H:%M:%S', ${column}, '+${clock.shiftDays} days')`;
  const SUMMARY = `
    o.order_id, o.customer_id, c.company_name AS customer_name, ${moved("o.order_date")} AS order_date,
    ${moved("o.required_date")} AS required_date,
    CASE WHEN ${moved("o.shipped_date")} <= :now THEN ${moved("o.shipped_date")} END AS shipped_date,
    s.name AS shipper, o.ship_city, o.ship_country, o.freight AS freight_dollars, o.employee_id
    FROM seed_orders o JOIN seed_customers c USING (customer_id) JOIN seed_shippers s USING (shipper_id)`;
  let refusals = options.tooManyFirst ? 1 : 0;

  return [
    http.get(`${OIM_API}/orders`, ({ request }) => {
      if (refusals > 0) {
        refusals -= 1;
        return HttpResponse.json(
          { detail: "Too many requests" },
          { status: 429, headers: { "Retry-After": "0" } },
        );
      }
      const params = new URL(request.url).searchParams;
      const from = params.get("from_date") ?? "0000-00-00";
      const page = Number(params.get("page") ?? 1);
      const perPage = Number(params.get("per_page") ?? 50);
      const where = `${moved("o.order_date")} <= :now AND ${moved("o.order_date")} >= :from || 'T00:00:00'`;
      const total = Number(
        db.prepare(`SELECT count(*) AS n FROM seed_orders o WHERE ${where}`).get({ now: clock.now, from })!.n,
      );
      const items = db
        .prepare(
          `SELECT ${SUMMARY} WHERE ${where} ORDER BY order_date DESC, o.order_id DESC LIMIT :limit OFFSET :offset`,
        )
        .all({ now: clock.now, from, limit: perPage, offset: (page - 1) * perPage });
      const pages = Math.max(1, Math.ceil(total / perPage));
      return HttpResponse.json({
        items,
        pagination: { page, per_page: perPage, total, pages, has_next: page < pages, has_prev: page > 1 },
      });
    }),
    http.get(`${OIM_API}/orders/:id`, ({ params }) => {
      const order = db
        .prepare(`SELECT ${SUMMARY} WHERE o.order_id = :id`)
        .get({ now: clock.now, id: Number(params.id) });
      if (!order) return HttpResponse.json({ detail: "No order" }, { status: 404 });
      const lines = db
        .prepare(
          `SELECT product_id, unit_price AS unit_price_dollars, quantity, discount AS discount_fraction
           FROM seed_order_lines WHERE order_id = ? ORDER BY product_id`,
        )
        .all(Number(params.id));
      return HttpResponse.json({ ...order, lines });
    }),
  ];
}
