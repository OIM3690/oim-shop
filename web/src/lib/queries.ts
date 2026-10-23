// One react-query option set per kind of data. A page asks for
// productsQuery({...}) and react-query caches the answer under its key, so two
// pages that need the same data share one request.
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, type CustomerQuery, type OrderQuery, type ProductQuery } from "./api";

// Lists that rarely change are kept for an hour; everything else for a minute.
const HOUR = 60 * 60 * 1000;

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: ({ signal }) => api.categories(signal),
    staleTime: HOUR,
  });

export const allCustomersQuery = () =>
  queryOptions({
    queryKey: ["customers", "all"],
    queryFn: ({ signal }) => api.allCustomers(signal),
    staleTime: HOUR,
  });

export const employeesQuery = () =>
  queryOptions({ queryKey: ["employees"], queryFn: ({ signal }) => api.employees(signal), staleTime: HOUR });

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

export const ordersQuery = (query: OrderQuery) =>
  queryOptions({
    queryKey: ["orders", query],
    queryFn: ({ signal }) => api.orders(query, signal),
    placeholderData: keepPreviousData,
  });

export const orderQuery = (id: number) =>
  queryOptions({ queryKey: ["order", id], queryFn: ({ signal }) => api.order(id, signal) });
