// A stand-in for oim-api's /shop endpoints, shared by the unit tests (through
// msw/node) and the end-to-end tests (through the browser worker). It answers
// from data recorded from the real API and filters and pages it the way the
// real API does.
import { http, HttpResponse } from "msw";
import categories from "./data/categories.json";
import customers from "./data/customers.json";
import employees from "./data/employees.json";
import orders from "./data/orders.json";
import products from "./data/products.json";
import suppliers from "./data/suppliers.json";

export const API = "https://oim.zhili.dev/shop";
export const data = { categories, customers, employees, orders, products, suppliers };

function paginate<T>(items: T[], params: URLSearchParams) {
  const page = Number(params.get("page") ?? 1);
  const perPage = Number(params.get("per_page") ?? 50);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    pagination: {
      page,
      per_page: perPage,
      total: items.length,
      pages,
      has_next: page < pages,
      has_prev: page > 1,
    },
  };
}

const contains = (value: string, part: string | null) =>
  !part || value.toLowerCase().includes(part.toLowerCase());

const notFound = (what: string) => HttpResponse.json({ detail: `No ${what}` }, { status: 404 });

export const handlers = [
  http.get(`${API}/categories`, () => HttpResponse.json(categories)),

  http.get(`${API}/products`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const category = params.get("category");
    const categoryName = categories.find(
      (c) => String(c.category_id) === category || c.name.toLowerCase() === category?.toLowerCase(),
    )?.name;
    const matches = products.filter(
      (p) => contains(p.name, params.get("name")) && (!category || p.category === categoryName),
    );
    return HttpResponse.json(paginate(matches, params));
  }),

  http.get(`${API}/products/:id`, ({ params }) => {
    const product = products.find((p) => String(p.product_id) === params.id);
    return product ? HttpResponse.json(product) : notFound(`product ${params.id}`);
  }),

  http.get(`${API}/customers`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const country = params.get("country");
    const matches = customers.filter(
      (c) =>
        contains(c.company_name, params.get("name")) &&
        (!country || c.country?.toLowerCase() === country.toLowerCase()),
    );
    return HttpResponse.json(paginate(matches, params));
  }),

  http.get(`${API}/customers/:id`, ({ params }) => {
    const customer = customers.find((c) => c.customer_id === String(params.id).toUpperCase());
    return customer ? HttpResponse.json(customer) : notFound(`customer ${params.id}`);
  }),

  http.get(`${API}/suppliers`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const country = params.get("country");
    const matches = suppliers.filter(
      (s) =>
        contains(s.company_name, params.get("name")) &&
        (!country || s.country.toLowerCase() === country.toLowerCase()),
    );
    return HttpResponse.json(paginate(matches, params));
  }),

  http.get(`${API}/suppliers/:id`, ({ params }) => {
    const supplier = suppliers.find((s) => String(s.supplier_id) === params.id);
    return supplier ? HttpResponse.json(supplier) : notFound(`supplier ${params.id}`);
  }),

  http.get(`${API}/employees`, () => HttpResponse.json(employees)),

  http.get(`${API}/employees/:id`, ({ params }) => {
    const employee = employees.find((e) => String(e.employee_id) === params.id);
    return employee ? HttpResponse.json(employee) : notFound(`employee ${params.id}`);
  }),

  http.get(`${API}/orders`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const customer = params.get("customer_id")?.toUpperCase();
    const employee = params.get("employee_id");
    const country = params.get("country")?.toLowerCase();
    const from = params.get("from_date");
    const to = params.get("to_date");
    const matches = orders
      .filter(
        (o) =>
          (!customer || o.customer_id === customer) &&
          (!employee || String(o.employee_id) === employee) &&
          (!country || o.ship_country.toLowerCase() === country) &&
          (!from || o.order_date.slice(0, 10) >= from) &&
          (!to || o.order_date.slice(0, 10) <= to),
      )
      .map(({ lines: _lines, ...summary }) => summary);
    return HttpResponse.json(paginate(matches, params));
  }),

  http.get(`${API}/orders/:id`, ({ params }) => {
    const order = orders.find((o) => String(o.order_id) === params.id);
    return order ? HttpResponse.json(order) : notFound(`order ${params.id}`);
  }),
];
