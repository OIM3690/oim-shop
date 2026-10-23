// Entering and changing orders. Every rule is checked here on the server;
// the form checks the same rules only so you see a problem before you submit.
//
// - A discontinued product cannot be ordered.
// - Quantity is a whole number from 1 to what is in stock.
// - Discount is from 0% to 25%, the range in the historical orders.
// - A product appears at most once in an order.
// - The unit price comes from the catalog; the request cannot carry one.
// - The required date is after the order date.
// - Only the rep who entered an order can change it, and only before it ships.
import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import type { AppEnv } from "../app.ts";
import * as schemas from "../schemas.ts";
import { transaction, type Database } from "../db.ts";
import { requireRep } from "../guards.ts";
import { pageQuery, paginate, query } from "../http.ts";
import { monthsOf, refreshOrderTotals, refreshProductMonthSales } from "../totals.ts";
import { SAME_CUSTOMER } from "./customers.ts";
import { ORDER_FROM, ORDER_SELECT, orderListQuery, readOrder, toOrderSummary } from "./orders.ts";

const FIRST_ENTERED_ID = 1_000_000;

const orderBody = schemas.orderInput;

type OrderBody = schemas.OrderInput;

/** A refusal the form can show next to the field it concerns. */
class Refusal extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(message);
    this.path = path;
  }
}

const body = zValidator("json", orderBody, (result, c) => {
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return c.json({ detail: issues.map((i) => i.message), issues }, 422);
  }
});

/**
 * Checks the rules that need the database. When an order is edited, its old
 * lines are put back into stock first, so the check sees that stock as free.
 */
function checkAgainstCatalog(db: Database, input: OrderBody, today: string) {
  if (input.required_date <= today)
    throw new Refusal("required_date", "The required date must be after today");
  if (
    !db.prepare(`SELECT 1 FROM customers c WHERE ${SAME_CUSTOMER}`).get({ customer_id: input.customer_id })
  ) {
    throw new Refusal("customer_id", "There is no such customer");
  }
  if (!db.prepare("SELECT 1 FROM shippers WHERE shipper_id = ?").get(input.shipper_id)) {
    throw new Refusal("shipper_id", "There is no such shipper");
  }
  const product = db.prepare(
    "SELECT name, unit_price, units_in_stock, discontinued FROM products WHERE product_id = ?",
  );
  return input.lines.map((line, i) => {
    const row = product.get(line.product_id);
    if (!row) throw new Refusal(`lines.${i}.product_id`, "There is no such product");
    if (Number(row.discontinued)) throw new Refusal(`lines.${i}.product_id`, `${row.name} is discontinued`);
    const available = Number(row.units_in_stock);
    if (line.quantity > available) {
      throw new Refusal(`lines.${i}.quantity`, `Only ${available} of ${row.name} in stock`);
    }
    return { ...line, unit_price: Number(row.unit_price) };
  });
}

function writeLines(db: Database, orderId: number, lines: ReturnType<typeof checkAgainstCatalog>) {
  const insert = db.prepare(
    "INSERT INTO order_lines (order_id, product_id, unit_price, quantity, discount) VALUES (?, ?, ?, ?, ?)",
  );
  const take = db.prepare("UPDATE products SET units_in_stock = units_in_stock - ? WHERE product_id = ?");
  for (const line of lines) {
    insert.run(orderId, line.product_id, line.unit_price, line.quantity, line.discount);
    take.run(line.quantity, line.product_id);
  }
}

/** Puts an order's lines back into stock and deletes them. */
function releaseLines(db: Database, orderId: number) {
  const held = new Map(
    db
      .prepare("SELECT product_id, quantity FROM order_lines WHERE order_id = ?")
      .all(orderId)
      .map((r) => [Number(r.product_id), Number(r.quantity)]),
  );
  const give = db.prepare("UPDATE products SET units_in_stock = units_in_stock + ? WHERE product_id = ?");
  for (const [productId, quantity] of held) give.run(quantity, productId);
  db.prepare("DELETE FROM order_lines WHERE order_id = ?").run(orderId);
}

function customerRow(db: Database, customerId: string) {
  return db.prepare(`SELECT customer_id, city, country FROM customers c WHERE ${SAME_CUSTOMER}`).get({
    customer_id: customerId,
  })!;
}

/**
 * Finds an order the signed-in rep may change. Another rep's order and a
 * Northwind order both answer 404, so the API does not reveal which it was.
 */
function ownOrder(c: Context<AppEnv>) {
  const orderId = Number(c.req.param("id"));
  const row = c.var.db
    .prepare("SELECT order_id, shipped_date FROM orders WHERE order_id = ? AND entered_by_user = ?")
    .get(orderId, c.var.user!.user_id);
  if (!row) return { error: c.json({ detail: `No order ${orderId} of yours` }, 404) };
  if (row.shipped_date !== null)
    return { error: c.json({ detail: "This order has shipped and can no longer change" }, 409) };
  return { orderId };
}

function refused(c: Context<AppEnv>, error: unknown) {
  if (error instanceof Refusal) {
    return c.json({ detail: [error.message], issues: [{ path: error.path, message: error.message }] }, 422);
  }
  throw error;
}

// requireRep sits on each route; a .use() here would also run for the read
// routes that share the /orders prefix.
export const orderEntry = new Hono<AppEnv>()
  .post("/", requireRep, body, (c) => {
    const db = c.var.db;
    const input = c.req.valid("json");
    const now = c.var.now();
    try {
      const orderId = transaction(db, () => {
        const lines = checkAgainstCatalog(db, input, now.slice(0, 10));
        const customer = customerRow(db, input.customer_id);
        const next = Number(db.prepare("SELECT max(order_id) + 1 AS id FROM orders").get()!.id);
        const id = Math.max(next, FIRST_ENTERED_ID);
        db.prepare(
          `INSERT INTO orders (order_id, customer_id, employee_id, order_date, required_date, shipper_id, freight,
             ship_city, ship_country, entered_by_user)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          String(customer.customer_id),
          c.var.user!.employee_id!,
          now,
          `${input.required_date}T00:00:00`,
          input.shipper_id,
          input.freight,
          customer.city,
          customer.country,
          c.var.user!.user_id,
        );
        writeLines(db, id, lines);
        refreshOrderTotals(db, [id]);
        refreshProductMonthSales(db, monthsOf(db, [id]));
        return id;
      });
      return c.json(readOrder(db, orderId), 201);
    } catch (error) {
      return refused(c, error);
    }
  })
  .put("/:id{[0-9]+}", requireRep, body, (c) => {
    const own = ownOrder(c);
    if (own.error) return own.error;
    const db = c.var.db;
    const input = c.req.valid("json");
    try {
      transaction(db, () => {
        releaseLines(db, own.orderId);
        const lines = checkAgainstCatalog(db, input, c.var.now().slice(0, 10));
        const customer = customerRow(db, input.customer_id);
        db.prepare(
          `UPDATE orders SET customer_id = ?, required_date = ?, shipper_id = ?, freight = ?, ship_city = ?,
             ship_country = ? WHERE order_id = ?`,
        ).run(
          String(customer.customer_id),
          `${input.required_date}T00:00:00`,
          input.shipper_id,
          input.freight,
          customer.city,
          customer.country,
          own.orderId,
        );
        writeLines(db, own.orderId, lines);
        refreshOrderTotals(db, [own.orderId]);
        refreshProductMonthSales(db, monthsOf(db, [own.orderId]));
      });
      return c.json(readOrder(db, own.orderId));
    } catch (error) {
      return refused(c, error);
    }
  })
  .post("/:id{[0-9]+}/cancel", requireRep, (c) => {
    const own = ownOrder(c);
    if (own.error) return own.error;
    const db = c.var.db;
    transaction(db, () => {
      const months = monthsOf(db, [own.orderId]);
      releaseLines(db, own.orderId);
      db.prepare("DELETE FROM orders WHERE order_id = ?").run(own.orderId);
      refreshProductMonthSales(db, months);
    });
    return c.body(null, 204);
  })
  .post("/:id{[0-9]+}/ship", requireRep, (c) => {
    const own = ownOrder(c);
    if (own.error) return own.error;
    c.var.db.prepare("UPDATE orders SET shipped_date = ? WHERE order_id = ?").run(c.var.now(), own.orderId);
    return c.json(readOrder(c.var.db, own.orderId));
  });

/** GET /api/me/orders: the signed-in rep's own orders, newest first unless sorted like /api/orders. */
export const myOrders = new Hono<AppEnv>().get(
  "/",
  requireRep,
  query({ ...pageQuery, sort: orderListQuery.sort }),
  (c) => {
    const q = c.req.valid("query");
    return c.json(
      paginate(
        c.var.db,
        {
          select: ORDER_SELECT,
          from: ORDER_FROM,
          where: ["o.entered_by_user = :user"],
          orderBy: `${q.sort}, o.order_id DESC`,
        },
        { user: c.var.user!.user_id },
        q.page,
        q.per_page,
        toOrderSummary,
      ),
    );
  },
);
