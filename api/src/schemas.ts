// The shape of every response the API sends, written once as zod schemas.
// The server's tests parse its responses with them, and the web app imports
// the same schemas (as "api/schemas") to check what it receives, so the two
// halves cannot drift apart unnoticed.
import { z } from "zod";

export const pagination = z.object({
  page: z.number(),
  per_page: z.number(),
  total: z.number(),
  pages: z.number(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

export const pageOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), pagination });

export const category = z.object({ category_id: z.number(), name: z.string(), description: z.string() });

export const shipper = z.object({ shipper_id: z.number(), name: z.string() });

export const product = z.object({
  product_id: z.number(),
  name: z.string(),
  category_id: z.number(),
  category: z.string(),
  supplier: z.string(),
  quantity_per_unit: z.string(),
  unit_price_dollars: z.number(),
  units_in_stock: z.number(),
  reorder_level: z.number(),
  low_stock: z.boolean(),
  discontinued: z.boolean(),
  revenue_dollars: z.number(),
});

export const customer = z.object({
  customer_id: z.string(),
  company_name: z.string(),
  contact_name: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  order_count: z.number(),
  revenue_dollars: z.number(),
});

export const employee = z.object({
  employee_id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  name: z.string(),
  title: z.string(),
  reports_to: z.number().nullable(),
  hire_date: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  is_rep: z.boolean(),
  order_count: z.number(),
  revenue_dollars: z.number(),
});

export const orderSummary = z.object({
  order_id: z.number(),
  customer_id: z.string(),
  customer_name: z.string(),
  order_date: z.string(),
  required_date: z.string(),
  shipped_date: z.string().nullable(),
  shipper_id: z.number(),
  shipper: z.string(),
  ship_city: z.string().nullable(),
  ship_country: z.string().nullable(),
  freight_dollars: z.number(),
  line_count: z.number(),
  order_total_dollars: z.number(),
  employee_id: z.number(),
  employee_name: z.string(),
  entered: z.boolean(),
});

export const orderLine = z.object({
  product_id: z.number(),
  product_name: z.string(),
  unit_price_dollars: z.number(),
  quantity: z.number(),
  discount_fraction: z.number(),
  line_total_dollars: z.number(),
});

export const order = orderSummary.extend({ lines: z.array(orderLine) });

export const health = z.object({
  status: z.literal("ok"),
  orders: z.number(),
  last_sync: z.string().nullable(),
});

export type Pagination = z.infer<typeof pagination>;
export type Category = z.infer<typeof category>;
export type Shipper = z.infer<typeof shipper>;
export type Product = z.infer<typeof product>;
export type Customer = z.infer<typeof customer>;
export type Employee = z.infer<typeof employee>;
export type OrderSummary = z.infer<typeof orderSummary>;
export type OrderLine = z.infer<typeof orderLine>;
export type Order = z.infer<typeof order>;

const revenue = { revenue_dollars: z.number(), order_count: z.number() };

export const dashboard = z.object({
  from: z.string(),
  to: z.string(),
  totals: z.object(revenue),
  revenue_by_month: z.array(z.object({ month: z.string(), ...revenue })),
  top_products: z.array(
    z.object({ product_id: z.number(), name: z.string(), revenue_dollars: z.number(), quantity: z.number() }),
  ),
  by_employee: z.array(z.object({ employee_id: z.number(), name: z.string(), ...revenue })),
  by_country: z.array(z.object({ country: z.string(), ...revenue })),
});

export type Dashboard = z.infer<typeof dashboard>;

export const me = z.object({ signed_in: z.boolean(), employee: employee.nullable() });
export type Me = z.infer<typeof me>;

// What a rep sends. The server checks these, and the web app's forms check
// the same schemas before sending, so a mistake shows next to its field.
export const displayName = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(40, "Use at most 40 characters")
  .regex(/^[\p{L}\p{M}\p{N} .'-]+$/u, "Use letters, digits, spaces, and . ' - only");

export const MAX_DISCOUNT = 0.25;

export const orderLineInput = z.strictObject({
  product_id: z.number().int().positive("Choose a product"),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  discount: z.number().min(0, "Discount cannot be negative").max(MAX_DISCOUNT, "Discount can be at most 25%"),
});

export const orderInput = z.strictObject({
  customer_id: z.string().trim().min(1, "Choose a customer").max(10),
  shipper_id: z.number().int().positive("Choose a shipper"),
  required_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  freight: z.number().min(0, "Freight cannot be negative").max(10_000, "Freight can be at most $10,000"),
  lines: z
    .array(orderLineInput)
    .min(1, "Add at least one product")
    .max(77)
    .refine(
      (lines) => new Set(lines.map((l) => l.product_id)).size === lines.length,
      "Each product can appear once",
    ),
});

export type OrderInput = z.infer<typeof orderInput>;
