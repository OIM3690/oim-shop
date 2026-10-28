// One react-query option set per kind of data. A page asks for
// productsQuery({...}) and react-query caches the answer under its key, so two
// pages that need the same data share one request. After a write, the keys
// in WRITE_AFFECTS are refetched, so every page shows the change at once.
import { keepPreviousData, queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  api,
  type CustomerQuery,
  type EmployeeQuery,
  type OrderQuery,
  type ProductQuery,
  type SortQuery,
  type SupplierQuery,
} from "./api";

const HOUR = 60 * 60 * 1000;

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: ({ signal }) => api.categories(signal),
    staleTime: HOUR,
  });

export const shippersQuery = () =>
  queryOptions({ queryKey: ["shippers"], queryFn: ({ signal }) => api.shippers(signal), staleTime: HOUR });

export const allCustomersQuery = () =>
  queryOptions({
    queryKey: ["customers", "all"],
    queryFn: ({ signal }) => api.allCustomers(signal),
    staleTime: HOUR,
  });

export const allProductsQuery = () =>
  queryOptions({ queryKey: ["products", "all"], queryFn: ({ signal }) => api.allProducts(signal) });

export const employeesQuery = (query: EmployeeQuery) =>
  queryOptions({
    queryKey: ["employees", query],
    queryFn: ({ signal }) => api.employees(query, signal),
    placeholderData: keepPreviousData,
  });

/** Under "employees", so a new rep or a new name refreshes it with the list. */
export const directoryQuery = () =>
  queryOptions({ queryKey: ["employees", "directory"], queryFn: ({ signal }) => api.directory(signal) });

export const productsQuery = (query: ProductQuery) =>
  queryOptions({
    queryKey: ["products", query],
    queryFn: ({ signal }) => api.products(query, signal),
    placeholderData: keepPreviousData,
  });

export const productQuery = (id: number) =>
  queryOptions({ queryKey: ["product", id], queryFn: ({ signal }) => api.product(id, signal) });

export const customersQuery = (query: CustomerQuery) =>
  queryOptions({
    queryKey: ["customers", query],
    queryFn: ({ signal }) => api.customers(query, signal),
    placeholderData: keepPreviousData,
  });

export const customerQuery = (id: string) =>
  queryOptions({ queryKey: ["customer", id], queryFn: ({ signal }) => api.customer(id, signal) });

export const employeeQuery = (id: number) =>
  queryOptions({ queryKey: ["employee", id], queryFn: ({ signal }) => api.employee(id, signal) });

export const suppliersQuery = (query: SupplierQuery) =>
  queryOptions({
    queryKey: ["suppliers", query],
    queryFn: ({ signal }) => api.suppliers(query, signal),
    placeholderData: keepPreviousData,
  });

export const supplierQuery = (id: number) =>
  queryOptions({ queryKey: ["supplier", id], queryFn: ({ signal }) => api.supplier(id, signal) });

export const regionsQuery = () =>
  queryOptions({ queryKey: ["regions"], queryFn: ({ signal }) => api.regions(signal), staleTime: HOUR });

export const ordersQuery = (query: OrderQuery) =>
  queryOptions({
    queryKey: ["orders", query],
    queryFn: ({ signal }) => api.orders(query, signal),
    placeholderData: keepPreviousData,
  });

export const orderQuery = (id: number) =>
  queryOptions({ queryKey: ["order", id], queryFn: ({ signal }) => api.order(id, signal) });

export const dashboardQuery = (range: { from?: string; to?: string }) =>
  queryOptions({
    queryKey: ["dashboard", range],
    queryFn: ({ signal }) => api.dashboard(range, signal),
    placeholderData: keepPreviousData,
  });

export const meQuery = () => queryOptions({ queryKey: ["me"], queryFn: ({ signal }) => api.me(signal) });

export const myOrdersQuery = (query: { page: number } & SortQuery) =>
  queryOptions({
    queryKey: ["my-orders", query],
    queryFn: ({ signal }) => api.myOrders(query, signal),
    placeholderData: keepPreviousData,
  });

/** Everything an order write can change: stock, revenue, lists, the dashboard. */
const WRITE_AFFECTS = [
  "orders",
  "order",
  "my-orders",
  "dashboard",
  "products",
  "product",
  "customers",
  "customer",
  "employees",
  "employee",
];

export function refetchAfterWrite(queryClient: QueryClient) {
  return Promise.all(WRITE_AFFECTS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

/** The `failed` prop of a SelectField whose options come from `query`. */
export const optionsFailed = (query: { isError: boolean; refetch: () => unknown }, what: string) =>
  query.isError ? { what, onRetry: () => void query.refetch() } : undefined;
