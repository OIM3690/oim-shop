import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import type { Database } from "./db.ts";
import { sameOriginWrites } from "./guards.ts";
import { notFound } from "./http.ts";
import { auth } from "./routes/auth.ts";
import { customers } from "./routes/customers.ts";
import { dashboard } from "./routes/dashboard.ts";
import { employees } from "./routes/employees.ts";
import { me } from "./routes/me.ts";
import { myOrders, orderEntry } from "./routes/order-entry.ts";
import { orders } from "./routes/orders.ts";
import { products } from "./routes/products.ts";
import { regions } from "./routes/regions.ts";
import { suppliers } from "./routes/suppliers.ts";
import { RateLimiter } from "./limits.ts";
import { readSession, type SessionUser } from "./session.ts";

export interface AppSettings {
  /** The address people open; sign-in returns here, and writes must come from it. */
  publicUrl: string;
  github: { clientId: string; clientSecret: string };
}

export interface Limits {
  /** Requests per minute from one client address. */
  perAddress: number;
  /** Writes per minute from one signed-in rep. */
  writesPerUser: number;
}

export interface AppOptions extends Partial<AppSettings> {
  db: Database;
  /** The header that carries the visitor's address, set by the proxy in front (Cloudflare: cf-connecting-ip). */
  clientIpHeader?: string;
  limits?: Limits;
  /** Boston time as "YYYY-MM-DDTHH:MM:SS"; tests pass a fixed moment. */
  now: () => string;
}

export type AppEnv = {
  Variables: { db: Database; now: () => string; settings: AppSettings; user: SessionUser | null };
};

export function createApp({
  db,
  now,
  publicUrl = "http://localhost:5173",
  github,
  clientIpHeader,
  limits = { perAddress: 300, writesPerUser: 30 },
}: AppOptions) {
  const settings: AppSettings = { publicUrl, github: github ?? { clientId: "", clientSecret: "" } };
  const perAddress = new RateLimiter(limits.perAddress);
  const writesPerUser = new RateLimiter(limits.writesPerUser);

  const api = new Hono<AppEnv>()
    .use(async (c, next) => {
      const wait = perAddress.take(clientAddress(c, clientIpHeader));
      if (wait) return tooMany(c, wait);
      c.set("db", db);
      c.set("now", now);
      c.set("settings", settings);
      c.set("user", readSession(c, db));
      await next();
      setCacheControl(c);
    })
    .use(sameOriginWrites(new URL(publicUrl).origin))
    .use(async (c, next) => {
      const user = c.var.user;
      if (user && !["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
        const wait = writesPerUser.take(String(user.user_id));
        if (wait) return tooMany(c, wait);
      }
      await next();
    })
    .get("/health", (c) => {
      c.header("Cache-Control", "no-store");
      const orderCount = Number(db.prepare("SELECT count(*) AS n FROM orders").get()!.n);
      const lastSync = db.prepare("SELECT value FROM app_state WHERE key = 'last_sync_at'").get();
      return c.json({
        status: "ok" as const,
        orders: orderCount,
        last_sync: lastSync ? String(lastSync.value) : null,
      });
    })
    .get("/categories", (c) =>
      c.json(db.prepare("SELECT category_id, name, description FROM categories ORDER BY category_id").all()),
    )
    .get("/categories/:id{[0-9]+}/picture", (c) => {
      const row = db
        .prepare("SELECT picture FROM categories WHERE category_id = ?")
        .get(Number(c.req.param("id")));
      if (!row?.picture) return c.json(notFound(`picture for category ${c.req.param("id")}`), 404);
      return c.body(row.picture as Uint8Array<ArrayBuffer>, 200, { "Content-Type": "image/jpeg" });
    })
    .get("/shippers", (c) =>
      c.json(db.prepare("SELECT shipper_id, name, phone FROM shippers ORDER BY shipper_id").all()),
    )
    .route("/suppliers", suppliers)
    .route("/regions", regions)
    .route("/products", products)
    .route("/customers", customers)
    .route("/orders", orders)
    .route("/orders", orderEntry)
    .route("/employees", employees)
    .route("/dashboard", dashboard)
    .route("/auth", auth)
    .route("/me/orders", myOrders)
    .route("/me", me);

  return new Hono().route("/api", api);
}

function clientAddress(c: Context, header?: string) {
  if (header) return c.req.header(header) ?? "unknown";
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown"; // not running under the Node server, as in tests
  }
}

function tooMany(c: Context, waitSeconds: number) {
  c.header("Retry-After", String(waitSeconds));
  return c.json({ detail: "Too many requests. Wait a minute, then try again." }, 429);
}

/**
 * A shared cache (Cloudflare, a proxy) may keep an anonymous read for a
 * minute. Anything that depends on who is signed in is private and never
 * stored, so one rep's page can never be served to someone else.
 */
function setCacheControl(c: Context<AppEnv>) {
  if (c.res.headers.has("Cache-Control")) return;
  const personal =
    c.var.user !== null || c.req.path.startsWith("/api/me") || c.req.path.startsWith("/api/auth");
  if (c.req.method === "GET" && c.res.status === 200 && !personal) {
    c.header("Cache-Control", "public, max-age=60");
  } else {
    c.header("Cache-Control", personal ? "private, no-store" : "no-store");
  }
}
