// Every call to the app's API goes through this file. The response schemas
// come from the server itself (api/src/schemas.ts), so the types the pages
// use are the shapes the server promises, and each response is checked
// against them when it arrives.
import * as schemas from "api/schemas";
import { z } from "zod";

export type {
  Category,
  Customer,
  Dashboard,
  Directory,
  Employee,
  EmployeeDetail,
  Me,
  Order,
  OrderLine,
  OrderSummary,
  Pagination,
  Product,
  Regions,
  Shipper,
  Supplier,
} from "api/schemas";

export const API_BASE = "/api";
export const PER_PAGE = 25;

const refusal = z.object({
  detail: z.union([z.string(), z.array(z.string())]),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

/** The API answered with an error status, such as 404, 422 or 429. */
export class ApiError extends Error {
  readonly status: number;
  /** Problems the server found with what was sent, by field, as in "lines.0.quantity". */
  readonly issues: { path: string; message: string }[];

  constructor(status: number, detail: string, issues: { path: string; message: string }[] = []) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

type Params = Record<string, string | number | undefined>;

async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  init: { params?: Params; method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<z.infer<T>> {
  const url = new URL(API_BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(init.params ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method: init.method ?? "GET",
    signal: init.signal,
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const parsed = refusal.safeParse(await response.json().catch(() => ({})));
    const detail = parsed.success
      ? [parsed.data.detail].flat().join(" ")
      : `The API answered ${response.status}`;
    throw new ApiError(response.status, detail, parsed.success ? (parsed.data.issues ?? []) : []);
  }
  if (response.status === 204) return schema.parse(undefined);
  return schema.parse(await response.json());
}

export type SortQuery = { sort?: string };
export interface ProductQuery extends SortQuery {
  name?: string;
  category?: number;
  supplier?: number;
  page: number;
}
export interface SupplierQuery extends SortQuery {
  name?: string;
  page: number;
}
export interface CustomerQuery extends SortQuery {
  name?: string;
  country?: string;
  page: number;
}
export interface EmployeeQuery extends SortQuery {
  page: number;
}
export interface OrderQuery extends SortQuery {
  customer_id?: string;
  employee_id?: number;
  country?: string;
  from_date?: string;
  to_date?: string;
  page: number;
  per_page?: number;
}

export interface OrderInput {
  customer_id: string;
  shipper_id: number;
  required_date: string;
  freight: number;
  lines: { product_id: number; quantity: number; discount: number }[];
}

const nothing = z.undefined();

export const api = {
  categories: (signal?: AbortSignal) => request("/categories", z.array(schemas.category), { signal }),
  shippers: (signal?: AbortSignal) => request("/shippers", z.array(schemas.shipper), { signal }),

  products: (query: ProductQuery, signal?: AbortSignal) =>
    request("/products", schemas.pageOf(schemas.product), {
      params: { ...query, per_page: PER_PAGE },
      signal,
    }),
  /** All 77 products at once, for the order form. */
  allProducts: (signal?: AbortSignal) =>
    request("/products", schemas.pageOf(schemas.product), {
      params: { per_page: 100, sort: "name" },
      signal,
    }).then((page) => page.items),
  product: (id: number, signal?: AbortSignal) => request(`/products/${id}`, schemas.product, { signal }),

  customers: (query: CustomerQuery, signal?: AbortSignal) =>
    request("/customers", schemas.pageOf(schemas.customer), {
      params: { ...query, per_page: PER_PAGE },
      signal,
    }),
  /** All 93 customers at once, for the filter menus and the order form. */
  allCustomers: (signal?: AbortSignal) =>
    request("/customers", schemas.pageOf(schemas.customer), {
      params: { per_page: 100, sort: "company_name" },
      signal,
    }).then((page) => page.items),
  customer: (id: string, signal?: AbortSignal) =>
    request(`/customers/${encodeURIComponent(id)}`, schemas.customer, { signal }),

  employees: (query: EmployeeQuery, signal?: AbortSignal) =>
    request("/employees", schemas.pageOf(schemas.employee), {
      params: { ...query, per_page: PER_PAGE },
      signal,
    }),
  /** Everyone's name and manager, for the reporting lines and the employee menus. */
  directory: (signal?: AbortSignal) => request("/employees/directory", schemas.directory, { signal }),
  employee: (id: number, signal?: AbortSignal) =>
    request(`/employees/${id}`, schemas.employeeDetail, { signal }),

  suppliers: (query: SupplierQuery, signal?: AbortSignal) =>
    request("/suppliers", schemas.pageOf(schemas.supplier), {
      params: { ...query, per_page: PER_PAGE },
      signal,
    }),
  supplier: (id: number, signal?: AbortSignal) => request(`/suppliers/${id}`, schemas.supplier, { signal }),

  regions: (signal?: AbortSignal) => request("/regions", schemas.regions, { signal }),

  orders: (query: OrderQuery, signal?: AbortSignal) =>
    request("/orders", schemas.pageOf(schemas.orderSummary), {
      params: { per_page: PER_PAGE, ...query },
      signal,
    }),
  order: (id: number, signal?: AbortSignal) => request(`/orders/${id}`, schemas.order, { signal }),

  dashboard: (range: { from?: string; to?: string }, signal?: AbortSignal) =>
    request("/dashboard", schemas.dashboard, { params: range, signal }),

  me: (signal?: AbortSignal) => request("/me", schemas.me, { signal }),
  setDisplayName: (display_name: string) =>
    request("/me", schemas.me, { method: "PUT", body: { display_name } }),
  signOut: () => request("/auth/logout", nothing, { method: "POST" }),
  myOrders: (query: { page: number } & SortQuery, signal?: AbortSignal) =>
    request("/me/orders", schemas.pageOf(schemas.orderSummary), { params: { ...query }, signal }),

  placeOrder: (input: OrderInput) => request("/orders", schemas.order, { method: "POST", body: input }),
  editOrder: (id: number, input: OrderInput) =>
    request(`/orders/${id}`, schemas.order, { method: "PUT", body: input }),
  cancelOrder: (id: number) => request(`/orders/${id}/cancel`, nothing, { method: "POST" }),
  shipOrder: (id: number) => request(`/orders/${id}/ship`, schemas.order, { method: "POST" }),
};

/** Images the API serves; an <img> loads them itself, so they do not go through request(). */
export const categoryPictureUrl = (categoryId: number) => `${API_BASE}/categories/${categoryId}/picture`;
export const employeePhotoUrl = (employeeId: number) => `${API_BASE}/employees/${employeeId}/photo`;

/** Where the "Sign in with GitHub" link points; the server sends the browser on to GitHub. */
export const SIGN_IN_URL = `${API_BASE}/auth/github`;
