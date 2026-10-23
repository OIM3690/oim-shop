// Pulls new orders from oim-api. Order IDs in Northwind do not follow date
// order, so sync reads by date: each run asks for every order from 40 days
// before the newest one stored, fetches the lines of any order it does not
// have, and records shipments of orders it already has (an order ships at
// most 37 days after it is placed). Orders are matched by ID, so running it
// twice changes nothing.
import { z } from "zod";
import { transaction, type Database } from "./db.ts";
import { monthsOf, refreshOrderTotals, refreshProductMonthSales } from "./totals.ts";

const WINDOW_DAYS = 40;
const MAX_RETRIES = 3;

// What sync reads from oim-api, checked before anything is written.
const summary = z.object({
  order_id: z.number().int(),
  customer_id: z.string(),
  employee_id: z.number().int(),
  order_date: z.string(),
  required_date: z.string(),
  shipped_date: z.string().nullable(),
  shipper: z.string(),
  ship_city: z.string().nullable(),
  ship_country: z.string().nullable(),
  freight_dollars: z.number(),
});
const listPage = z.object({ items: z.array(summary), pagination: z.object({ has_next: z.boolean() }) });
const detail = summary.extend({
  lines: z.array(
    z.object({
      product_id: z.number().int(),
      unit_price_dollars: z.number(),
      quantity: z.number().int().positive(),
      discount_fraction: z.number().min(0).max(1),
    }),
  ),
});

export interface SyncOptions {
  apiBase: string;
  /** Boston time as "YYYY-MM-DDTHH:MM:SS", recorded as the time of this run. */
  now: string;
  /** Pause between requests for single orders, to stay well inside oim-api's rate limit. */
  pauseMs?: number;
}

export interface SyncResult {
  added: number;
  shipped: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url);
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const wait = Math.min(Number(response.headers.get("Retry-After") ?? 10), 60);
      await sleep(wait * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return schema.parse(await response.json());
  }
}

export async function syncOrders(
  db: Database,
  { apiBase, now, pauseMs = 200 }: SyncOptions,
): Promise<SyncResult> {
  const newest = db.prepare("SELECT max(order_date) AS d FROM orders WHERE entered_by_user IS NULL").get()?.d;
  const from = newest
    ? String(db.prepare(`SELECT date(?, '-${WINDOW_DAYS} days') AS d`).get(String(newest))!.d)
    : "2000-01-01";

  const listed: z.infer<typeof summary>[] = [];
  for (let page = 1; ; page++) {
    const body = await getJson(`${apiBase}/orders?from_date=${from}&per_page=100&page=${page}`, listPage);
    listed.push(...body.items);
    if (!body.pagination.has_next) break;
  }

  const known = db.prepare("SELECT shipped_date FROM orders WHERE order_id = ?");
  const shipperId = db.prepare("SELECT shipper_id FROM shippers WHERE name = ?");
  const markShipped = db.prepare(
    "UPDATE orders SET shipped_date = ? WHERE order_id = ? AND shipped_date IS NULL",
  );
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_id, customer_id, employee_id, order_date, required_date, shipped_date,
      shipper_id, freight, ship_city, ship_country)
    VALUES (:order_id, :customer_id, :employee_id, :order_date, :required_date, :shipped_date,
      :shipper_id, :freight, :ship_city, :ship_country)`);
  const insertLine = db.prepare(
    "INSERT INTO order_lines (order_id, product_id, unit_price, quantity, discount) VALUES (?, ?, ?, ?, ?)",
  );

  let shipped = 0;
  const added: number[] = [];
  for (const item of listed) {
    const existing = known.get(item.order_id);
    if (existing) {
      if (existing.shipped_date === null && item.shipped_date) {
        shipped += Number(markShipped.run(item.shipped_date, item.order_id).changes);
      }
      continue;
    }

    const order = await getJson(`${apiBase}/orders/${item.order_id}`, detail);
    const shipper = shipperId.get(order.shipper);
    if (!shipper) throw new Error(`Order ${order.order_id} names an unknown shipper, ${order.shipper}`);
    transaction(db, () => {
      insertOrder.run({
        order_id: order.order_id,
        customer_id: order.customer_id,
        employee_id: order.employee_id,
        order_date: order.order_date,
        required_date: order.required_date,
        shipped_date: order.shipped_date,
        shipper_id: Number(shipper.shipper_id),
        freight: order.freight_dollars,
        ship_city: order.ship_city,
        ship_country: order.ship_country,
      });
      for (const line of order.lines) {
        insertLine.run(
          order.order_id,
          line.product_id,
          line.unit_price_dollars,
          line.quantity,
          line.discount_fraction,
        );
      }
      refreshOrderTotals(db, [order.order_id]);
    });
    added.push(order.order_id);
    if (pauseMs > 0) await sleep(pauseMs);
  }

  transaction(db, () => {
    refreshProductMonthSales(db, monthsOf(db, added));
    db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES ('last_sync_at', ?)").run(now);
  });
  return { added: added.length, shipped };
}
