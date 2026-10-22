// A stand-in for oim-api's /shop endpoints, so the tests never depend on the
// network. It answers from data recorded from the real API and filters and
// pages that data the way the real API does.
import { readFileSync } from "node:fs";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

export const allProducts = fixture("products");
export const allCategories = fixture("categories");

const CORS = { "access-control-allow-origin": "*" };

/**
 * Routes the page's requests to the fake API and returns the list of
 * requested URLs, newest last.
 *
 * options.products  replaces the recorded products
 * options.status    (url) => an HTTP status to fail with, or undefined
 * options.wait      (url) => a promise to wait for before answering
 */
export async function useFakeApi(page, options = {}) {
  const products = options.products ?? allProducts;
  const requests = [];

  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());

  await page.route("https://oim.zhili.dev/shop/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    await options.wait?.(url);

    const status = options.status?.(url);
    if (status) {
      return route.fulfill({ status, headers: CORS, json: { detail: "Fake failure" } });
    }
    if (url.pathname === "/shop/categories") {
      return route.fulfill({ headers: CORS, json: allCategories });
    }
    if (url.pathname === "/shop/products") {
      return route.fulfill({ headers: CORS, json: listProducts(products, url.searchParams) });
    }
    return route.fulfill({ status: 404, headers: CORS, json: { detail: "Not found" } });
  });

  return requests;
}

function listProducts(products, params) {
  const name = (params.get("name") ?? "").toLowerCase();
  const category = (params.get("category") ?? "").toLowerCase();
  const page = Number(params.get("page") ?? 1);
  const perPage = Number(params.get("per_page") ?? 50);

  const categoryName = allCategories.find(
    (c) => String(c.category_id) === category || c.name.toLowerCase() === category,
  )?.name;

  const matches = products.filter(
    (p) => p.name.toLowerCase().includes(name) && (!category || p.category === categoryName),
  );
  const pages = Math.max(1, Math.ceil(matches.length / perPage));

  return {
    items: matches.slice((page - 1) * perPage, page * perPage),
    pagination: {
      page,
      per_page: perPage,
      total: matches.length,
      pages,
      has_next: page < pages,
      has_prev: page > 1,
    },
  };
}
