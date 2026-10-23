import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server, testDb, value } from "./api-server";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

describe("products", () => {
  it("lists the first page with the total, revenue and stock", async () => {
    renderApp("/products");
    expect(await screen.findByText("1–25 of 77")).toBeInTheDocument();
    expect(rows()).toHaveLength(25);
    expect(rows()[0]).toHaveTextContent("Chai");
    expect(rows()[0]).toHaveTextContent("$18.00");
  });

  it("searches by name on the server and keeps the search in the address", async () => {
    const requests = recordRequests("/products");
    const { user, location } = renderApp("/products");
    await screen.findByText("1–25 of 77");

    await user.type(screen.getByLabelText("Product name"), "chai{Enter}");

    expect(await screen.findByText("1–1 of 1")).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("name")).toBe("chai");
    expect(location().search).toMatchObject({ name: "chai" });
  });

  it("filters by category and starts again at page 1", async () => {
    const { user, location } = renderApp("/products?page=2");
    await screen.findByText("26–50 of 77");
    await user.selectOptions(await screen.findByLabelText("Category"), "Beverages");
    expect(await screen.findByText("1–12 of 12")).toBeInTheDocument();
    expect(location().search).toEqual({ category: 1 });
  });

  it("sorts by revenue on the server, largest first, then the other way", async () => {
    const requests = recordRequests("/products");
    const { user, location } = renderApp("/products");
    await screen.findByText("1–25 of 77");

    await user.click(screen.getByRole("button", { name: "Sort by revenue" }));
    expect(location().search).toEqual({ sort: "-revenue" });
    const best = value(
      "SELECT p.name FROM product_month_sales s JOIN products p USING (product_id) GROUP BY s.product_id ORDER BY sum(s.revenue) DESC LIMIT 1",
    );
    await screen.findByText(String(best), { selector: "a" });
    expect(rows()[0]).toHaveTextContent(String(best));
    expect(requests.at(-1)!.searchParams.get("sort")).toBe("-revenue");

    await user.click(screen.getByRole("button", { name: "Sort by revenue" }));
    expect(location().search).toEqual({ sort: "revenue" });
  });

  it("flags low stock", async () => {
    renderApp("/products");
    await screen.findByText("1–25 of 77");
    const low = Number(
      value(
        "SELECT count(*) FROM products WHERE units_in_stock < reorder_level AND units_in_stock > 0 AND discontinued = 0 AND product_id <= 25",
      ),
    );
    expect(screen.queryAllByText("Low stock")).toHaveLength(low);
  });

  it("explains an empty search and clears it", async () => {
    const { user, location } = renderApp("/products?name=zzz");
    expect(await screen.findByText("No products matching “zzz”.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByText("1–25 of 77")).toBeInTheDocument();
    expect(location().search).toEqual({});
  });

  it("shows an error and recovers with Try again", async () => {
    let fail = true;
    server.use(
      http.get("http://localhost:3000/api/products", () =>
        fail ? HttpResponse.json({ detail: "down" }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderApp("/products");
    expect(await screen.findByText("The product list did not load.")).toBeInTheDocument();
    expect(screen.getByText("The server ran into a problem. Try again in a moment.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1–25 of 77")).toBeInTheDocument();
  });

  it("opens a product with its reorder level and revenue", async () => {
    const { user } = renderApp("/products");
    await user.click(await screen.findByRole("link", { name: "Alice Mutton" }));
    expect(await screen.findByRole("heading", { name: "Alice Mutton" })).toBeInTheDocument();
    expect(screen.getByText("Pavlova, Ltd.")).toBeInTheDocument();
    expect(screen.getByText("Reorder level")).toBeInTheDocument();
    expect(screen.getByText("Revenue, all time")).toBeInTheDocument();
  });

  it("says so when a product does not exist", async () => {
    renderApp("/products/999");
    expect(await screen.findByText("There is no product 999.")).toBeInTheDocument();
  });

  it("uses the list's words for a product's state on its page", async () => {
    testDb().exec("UPDATE products SET units_in_stock = 0, discontinued = 0 WHERE product_id = 1");
    renderApp("/products/1");
    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
    expect(screen.queryByText("Available to order")).not.toBeInTheDocument();
  });

  it("calls low stock the same on a product's page as in the list", async () => {
    testDb().exec(
      "UPDATE products SET units_in_stock = 1, reorder_level = 10, discontinued = 0 WHERE product_id = 2",
    );
    renderApp("/products/2");
    expect(await screen.findByText("Low stock")).toBeInTheDocument();
    expect(screen.queryByText("Below reorder level")).not.toBeInTheDocument();
  });

  it("says the categories did not load instead of offering an empty menu", async () => {
    server.use(http.get("http://localhost:3000/api/categories", () => new Response(null, { status: 500 })));
    const { user } = renderApp("/products");
    await screen.findByText("1–25 of 77");
    expect(await screen.findByRole("combobox", { name: "Category" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Categories did not load" })).toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again: Category" }));
    expect(await screen.findByRole("option", { name: "Beverages" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeEnabled();
  });
});
