import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { useFakeApi, allProducts } from "./fake-api.js";

// Opened straight from disk, the way the PRD says v1 must work.
const V1 = pathToFileURL(resolve("v1/index.html")).href;

const productLines = (page) => page.locator("#product-list button.item");
const lastProductRequest = (requests) =>
  requests.filter((url) => url.pathname === "/shop/products").at(-1);

test("lists the first page of products with the total", async ({ page }) => {
  const requests = await useFakeApi(page);
  await page.goto(V1);

  await expect(page.locator("#summary")).toHaveText("77 products");
  await expect(productLines(page)).toHaveCount(20);
  await expect(productLines(page).first()).toContainText("Chai");
  await expect(productLines(page).first()).toContainText("$18.00");
  await expect(page.locator("#page-label")).toHaveText("Page 1 of 4");

  const request = lastProductRequest(requests);
  expect(request.searchParams.get("page")).toBe("1");
  expect(request.searchParams.get("per_page")).toBe("20");
});

test("search sends the name to the API and shows only what it returns", async ({ page }) => {
  const requests = await useFakeApi(page);
  await page.goto(V1);
  await expect(productLines(page)).toHaveCount(20);

  await page.getByLabel("Product name").fill("chai");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.locator("#summary")).toHaveText("1 product matching “chai”");
  await expect(productLines(page)).toHaveCount(1);
  expect(lastProductRequest(requests).searchParams.get("name")).toBe("chai");
  await expect(page.locator("#pager")).toBeHidden();
});

test("choosing a category filters on the server and starts again at page 1", async ({ page }) => {
  const requests = await useFakeApi(page);
  await page.goto(V1);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("#page-label")).toHaveText("Page 2 of 4");

  await page.getByLabel("Category").selectOption({ label: "Beverages" });

  await expect(page.locator("#summary")).toHaveText("12 products in Beverages");
  const request = lastProductRequest(requests);
  expect(request.searchParams.get("category")).toBe("1");
  expect(request.searchParams.get("page")).toBe("1");
});

test("next and previous move through the API's pages", async ({ page }) => {
  const requests = await useFakeApi(page);
  await page.goto(V1);
  const previous = page.getByRole("button", { name: "Previous" });
  const next = page.getByRole("button", { name: "Next" });

  await expect(previous).toBeDisabled();
  for (let n = 2; n <= 4; n++) {
    await next.click();
    await expect(page.locator("#page-label")).toHaveText(`Page ${n} of 4`);
  }
  await expect(next).toBeDisabled();
  await expect(productLines(page)).toHaveCount(17);
  expect(lastProductRequest(requests).searchParams.get("page")).toBe("4");

  await previous.click();
  await expect(page.locator("#page-label")).toHaveText("Page 3 of 4");
});

test("a product opens its details and closes again", async ({ page }) => {
  await useFakeApi(page);
  await page.goto(V1);

  await productLines(page).filter({ hasText: "Chai" }).click();
  const dialog = page.getByRole("dialog", { name: "Chai" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Exotic Liquids");
  await expect(dialog).toContainText("10 boxes x 20 bags");
  await expect(dialog).toContainText("Soft drinks, coffees, teas, beers, and ales");
  await expect(dialog).toContainText("Available to order");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("stock shows out of stock and discontinued products", async ({ page }) => {
  const products = [
    { ...allProducts[0], name: "In Stock Tea", units_in_stock: 1234, discontinued: false },
    { ...allProducts[0], name: "Empty Shelf Tea", units_in_stock: 0, discontinued: false },
    { ...allProducts[0], name: "Retired Tea", units_in_stock: 0, discontinued: true },
  ];
  await useFakeApi(page, { products });
  await page.goto(V1);

  await expect(productLines(page).nth(0)).toContainText("1,234 in stock");
  await expect(productLines(page).nth(1)).toContainText("Out of stock");
  await expect(productLines(page).nth(2)).toContainText("Discontinued");
});

test("a search with no match explains itself and can be cleared", async ({ page }) => {
  await useFakeApi(page);
  await page.goto(V1);

  await page.getByLabel("Product name").fill("zzz");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "No products matching “zzz”." })).toBeVisible();
  await expect(page.locator("#summary")).toHaveText("0 products matching “zzz”");
  await expect(page.locator("#pager")).toBeHidden();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator("#summary")).toHaveText("77 products");
  await expect(page.getByLabel("Product name")).toHaveValue("");
});

test("a failed request shows an error and Try again recovers", async ({ page }) => {
  let failing = true;
  await useFakeApi(page, {
    status: (url) => (failing && url.pathname === "/shop/products" ? 500 : undefined),
  });
  await page.goto(V1);

  await expect(page.getByRole("heading", { name: "The product list did not load." })).toBeVisible();
  await expect(productLines(page)).toHaveCount(0);

  failing = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#summary")).toHaveText("77 products");
});

test("a rate-limited request says to wait", async ({ page }) => {
  await useFakeApi(page, { status: (url) => (url.pathname === "/shop/products" ? 429 : undefined) });
  await page.goto(V1);

  await expect(page.getByRole("heading", { name: "Too many requests for now." })).toBeVisible();
  await expect(page.locator("#status")).toContainText("Wait a minute");
});

test("the list shows a loading state until the API answers", async ({ page }) => {
  let answer;
  const answered = new Promise((resolve) => (answer = resolve));
  await useFakeApi(page, { wait: (url) => (url.pathname === "/shop/products" ? answered : null) });
  await page.goto(V1);

  await expect(page.locator("#results")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#summary")).toHaveText("Loading products…");
  await expect(page.locator(".skeleton")).toHaveCount(5);

  answer();
  await expect(page.locator("#results")).toHaveAttribute("aria-busy", "false");
  await expect(productLines(page)).toHaveCount(20);
});

test("a slow earlier response never replaces a newer one", async ({ page }) => {
  let releaseFirst;
  const firstHeld = new Promise((resolve) => (releaseFirst = resolve));
  await useFakeApi(page, {
    wait: (url) => (url.pathname === "/shop/products" && !url.searchParams.has("name") ? firstHeld : null),
  });
  await page.goto(V1);

  await page.getByLabel("Product name").fill("chai");
  await page.keyboard.press("Enter");
  await expect(page.locator("#summary")).toHaveText("1 product matching “chai”");

  releaseFirst();
  await page.waitForTimeout(200);
  await expect(page.locator("#summary")).toHaveText("1 product matching “chai”");
  await expect(productLines(page)).toHaveCount(1);
});

test("a product name is shown as text, never run as HTML", async ({ page }) => {
  const name = '<img src=x onerror="window.injected = true">';
  await useFakeApi(page, { products: [{ ...allProducts[0], name }] });
  await page.goto(V1);

  await expect(productLines(page).first()).toContainText(name);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});
