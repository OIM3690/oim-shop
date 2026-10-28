// Every call to oim-api goes through this file. Each response is checked
// against a zod schema, and the TypeScript types come from the same schemas,
// so the shape of the data is written down exactly once.
import { z } from "zod";

export const API_BASE = "https://oim.zhili.dev/shop";
export const PER_PAGE = 25;

const pagination = z.object({
  page: z.number(),
  per_page: z.number(),
  total: z.number(),
  pages: z.number(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

const pageOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), pagination });

const category = z.object({
  category_id: z.number(),
  name: z.string(),
  description: z.string(),
});

const product = z.object({
  product_id: z.number(),
  name: z.string(),
  category: z.string(),
  supplier: z.string(),
  quantity_per_unit: z.string(),
  unit_price_dollars: z.number(),
  units_in_stock: z.number(),
  discontinued: z.boolean(),
});

const customer = z.object({
  customer_id: z.string(),
  company_name: z.string(),
  contact_name: z.string(),
  contact_title: z.string().nullable(),
  address: z.string().nullable(),
  // Two customers in the source data have no city or country.
  city: z.string().nullable(),
  region: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  fax: z.string().nullable(),
});

const supplier = z.object({
  supplier_id: z.number(),
  company_name: z.string(),
  contact_name: z.string().nullable(),
  contact_title: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  fax: z.string().nullable(),
  /** A web address, or null. */
  home_page: z.string().nullable(),
});

const employee = z.object({
  employee_id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  title: z.string(),
  reports_to: z.number().nullable(),
  hire_date: z.string(),
  city: z.string(),
  country: z.string(),
});

const orderSummary = z.object({
  order_id: z.number(),
  customer_id: z.string(),
  customer_name: z.string(),
  order_date: z.string(),
  required_date: z.string(),
  shipped_date: z.string().nullable(),
  shipper: z.string(),
  ship_city: z.string(),
  ship_country: z.string(),
  freight_dollars: z.number(),
  line_count: z.number(),
  order_total_dollars: z.number(),
  employee_id: z.number(),
  employee_name: z.string(),
});

const orderLine = z.object({
  product_id: z.number(),
  product_name: z.string(),
  unit_price_dollars: z.number(),
  quantity: z.number(),
  discount_fraction: z.number(),
  line_total_dollars: z.number(),
});

const order = orderSummary.extend({ lines: z.array(orderLine) });

export type Category = z.infer<typeof category>;
export type Product = z.infer<typeof product>;
export type Customer = z.infer<typeof customer>;
export type Supplier = z.infer<typeof supplier>;
export type Employee = z.infer<typeof employee>;
export type OrderSummary = z.infer<typeof orderSummary>;
export type Order = z.infer<typeof order>;
export type Pagination = z.infer<typeof pagination>;

/** The API answered, but with an error status such as 404 or 429. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`oim-api answered ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

type Params = Record<string, string | number | undefined>;

async function get<T extends z.ZodType>(
  path: string,
  schema: T,
  params: Params = {},
  signal?: AbortSignal,
): Promise<z.infer<T>> {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { signal });
  if (!response.ok) throw new ApiError(response.status);
  return schema.parse(await response.json());
}

export interface ProductQuery {
  name?: string;
  category?: string;
  page: number;
}

export interface CustomerQuery {
  name?: string;
  country?: string;
  page: number;
}
export interface SupplierQuery {
  name?: string;
  page: number;
}

export interface OrderQuery {
  customer_id?: string;
  employee_id?: number;
  country?: string;
  from_date?: string;
  to_date?: string;
  page: number;
  per_page?: number;
}

export const api = {
  categories: (signal?: AbortSignal) => get("/categories", z.array(category), {}, signal),

  products: (query: ProductQuery, signal?: AbortSignal) =>
    get("/products", pageOf(product), { ...query, per_page: PER_PAGE }, signal),

  product: (id: number, signal?: AbortSignal) => get(`/products/${id}`, product, {}, signal),

  customers: (query: CustomerQuery, signal?: AbortSignal) =>
    get("/customers", pageOf(customer), { ...query, per_page: PER_PAGE }, signal),

  /** All 93 customers at once, for the filter menus. */
  allCustomers: (signal?: AbortSignal) =>
    get("/customers", pageOf(customer), { per_page: 100 }, signal).then((page) => page.items),

  customer: (id: string, signal?: AbortSignal) =>
    get(`/customers/${encodeURIComponent(id)}`, customer, {}, signal),

  suppliers: (query: SupplierQuery, signal?: AbortSignal) =>
    get("/suppliers", pageOf(supplier), { ...query, per_page: PER_PAGE }, signal),

  supplier: (id: number, signal?: AbortSignal) => get(`/suppliers/${id}`, supplier, {}, signal),

  employees: (signal?: AbortSignal) => get("/employees", z.array(employee), {}, signal),

  employee: (id: number, signal?: AbortSignal) => get(`/employees/${id}`, employee, {}, signal),

  orders: (query: OrderQuery, signal?: AbortSignal) =>
    get("/orders", pageOf(orderSummary), { per_page: PER_PAGE, ...query }, signal),

  order: (id: number, signal?: AbortSignal) => get(`/orders/${id}`, order, {}, signal),
};
