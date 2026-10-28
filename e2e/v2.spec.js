import { test, expect } from "@playwright/test";

// The build under test answers every oim-api request from recorded data
// (web/src/mocks), so these tests never reach the network.

async function openSection(page, isMobile, name) {
  if (isMobile) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name }).click();
}

test("the sidebar reaches every section", async ({ page, isMobile }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.getByText("1–25 of 77")).toBeVisible();

  for (const name of ["Customers", "Orders", "Employees"]) {
    await openSection(page, isMobile, name);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  }
});

test("search for a product and open it", async ({ page }) => {
  await page.goto("products");
  await page.getByLabel("Product name").fill("chai");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\?name=chai$/);

  await page.getByRole("link", { name: "Chai" }).click();
  await expect(page.getByRole("heading", { name: "Chai" })).toBeVisible();
  await expect(page.getByText("Exotic Liquids")).toBeVisible();

  await page.goBack();
  await expect(page.getByLabel("Product name")).toHaveValue("chai");
});

test("follow an order to its customer and employee", async ({ page }) => {
  await page.goto("orders");
  await page.getByRole("link", { name: "21646", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order 21646" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(7);

  await page.getByRole("link", { name: "Michael Suyama" }).click();
  await expect(page.getByRole("heading", { name: "Michael Suyama" })).toBeVisible();
  await expect(page.getByText("Orders taken")).toBeVisible();
});

test("a deep link opens the right page", async ({ page }) => {
  await page.goto("customers/ALFKI");
  await expect(page.getByRole("heading", { name: "Alfreds Futterkiste" })).toBeVisible();
  await expect(page.getByText(/^1–\d+ of \d+$/)).toBeVisible();
});

test("filters live in the address", async ({ page }) => {
  await page.goto("orders?employee=5");
  await expect(page.getByLabel("Employee")).toHaveValue("5");
  await expect(page.getByRole("table")).not.toContainText("Michael Suyama");
});

test("v1 runs beside v2, at /v1/", async ({ page }) => {
  // v1 calls oim-api from the browser; answer with no products, so the test stays offline.
  await page.route("https://oim.zhili.dev/**", (route) =>
    route.fulfill({ json: { items: [], pagination: { page: 1, per_page: 25, total: 0, pages: 1 } } }),
  );
  await page.goto("v1/");
  await expect(page).toHaveTitle("Northwind Products");
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
});
