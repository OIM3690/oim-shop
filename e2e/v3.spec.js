import { test, expect } from "@playwright/test";

// GitHub's sign-in page is skipped: the test lets the app's /api/auth/github
// answer as usual (it sets the state cookie and points at github.com), then
// points that redirect straight back at the app's callback with a code the
// fake GitHub inside e2e/server.ts accepts. The callback, the token exchange
// and the session are all the real ones.
async function signInWithGitHub(page, code) {
  await page.route("**/api/auth/github", async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const toGitHub = new URL(response.headers().location);
    const back = new URL(toGitHub.searchParams.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", toGitHub.searchParams.get("state"));
    await route.fulfill({ response, headers: { ...response.headers(), location: back.toString() } });
  });
}

async function openSection(page, isMobile, name) {
  if (isMobile) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name }).click();
}

test("the dashboard opens with this year's figures", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Sales dashboard" })).toBeVisible();
  await expect(page.getByText("Nov 2025 to Oct 2026")).toBeVisible();
  await expect(page.getByRole("table", { name: "Top products, by revenue" })).toBeVisible();
});

test("the sidebar reaches every section", async ({ page, isMobile }) => {
  await page.goto("./");
  for (const name of [
    "Products",
    "Customers",
    "Orders",
    "Employees",
    "Suppliers",
    "Territories",
    "Dashboard",
  ]) {
    await openSection(page, isMobile, name);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name === "Dashboard" ? "Sales dashboard" : name);
  }
});

test("a list sorts on the server from its header", async ({ page }) => {
  await page.goto("products");
  await page.getByRole("button", { name: "Sort by revenue" }).click();
  await expect(page).toHaveURL(/sort=-revenue/);
  await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText("Côte de Blaye");
});

test("a deep link opens the right page", async ({ page }) => {
  await page.goto("orders/10248");
  await expect(page.getByRole("heading", { name: "Order 10248" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Vins et alcools Chevalier" })).toBeVisible();
});

test("sign in, choose a name, enter an order and cancel it", async ({ page, isMobile }, testInfo) => {
  // Each project signs in as its own GitHub user, so the runs do not share orders.
  const code = testInfo.project.name.endsWith("phone") ? "ben" : "ana";
  await signInWithGitHub(page, code);
  await page.goto("orders/new");
  await page.getByRole("link", { name: "Sign in with GitHub" }).first().click();

  await expect(page.getByRole("heading", { name: "Welcome to Northwind" })).toBeVisible();
  await page.getByLabel("Display name").fill(code === "ana" ? "Ana Ruiz" : "Ben Okafor");
  await page.getByRole("button", { name: "Start as a sales rep" }).click();

  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
  await page.getByLabel("Customer").selectOption({ label: "Alfreds Futterkiste" });
  await page.getByLabel("Product").selectOption({ label: "Chai" });
  await page.getByLabel("Quantity").fill("3");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page.getByRole("heading", { name: /^Order 100000\d$/ })).toBeVisible();
  await expect(page.getByText("Entered here")).toBeVisible();

  await openSection(page, isMobile, "My orders");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await page.getByRole("table").getByRole("link").first().click();

  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("You have not entered an order yet.")).toBeVisible();
});

test("a visitor cannot reach order entry without signing in", async ({ page }) => {
  await page.goto("orders/new");
  await expect(page.getByText("Sign in to enter orders.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Place order" })).toHaveCount(0);
});
