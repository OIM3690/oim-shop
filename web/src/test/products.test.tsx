import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, data } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

describe("products", () => {
  it("opens on the products page", async () => {
    const { location } = renderApp("/");
    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(location().pathname).toMatch(/\/products$/);
  });

  it("lists the first page with the total", async () => {
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
    expect(rows()).toHaveLength(1);
    expect(requests.at(-1)!.searchParams.get("name")).toBe("chai");
    expect(location().search).toMatchObject({ name: "chai" });
  });

  it("filters by category and starts again at page 1", async () => {
    const requests = recordRequests("/products");
    const { user, location } = renderApp("/products?page=2");
    await screen.findByText("26–50 of 77");

    await user.selectOptions(await screen.findByLabelText("Category"), "Beverages");

    const beverages = data.products.filter((p) => p.category === "Beverages").length;
    expect(await screen.findByText(`1–${beverages} of ${beverages}`)).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("category")).toBe("1");
    expect(location().search).toEqual({ category: 1 });
  });

  it("moves to the next page", async () => {
    const { user, location } = renderApp("/products");
    await screen.findByText("1–25 of 77");

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("26–50 of 77")).toBeInTheDocument();
    expect(location().search).toEqual({ page: 2 });
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
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
      http.get(`${API}/products`, () => (fail ? HttpResponse.json({}, { status: 500 }) : undefined)),
    );
    const { user } = renderApp("/products");

    expect(await screen.findByText("The product list did not load.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1–25 of 77")).toBeInTheDocument();
  });

  it("says to wait when the API is rate limiting", async () => {
    server.use(http.get(`${API}/products`, () => HttpResponse.json({}, { status: 429 })));
    renderApp("/products");
    expect(await screen.findByText("Too many requests for now.")).toBeInTheDocument();
  });

  it("opens a product from the list", async () => {
    const { user, location } = renderApp("/products");
    await user.click(await screen.findByRole("link", { name: "Alice Mutton" }));

    expect(await screen.findByRole("heading", { name: "Alice Mutton" })).toBeInTheDocument();
    expect(location().pathname).toMatch(/\/products\/17$/);
    expect(screen.getByText("Pavlova, Ltd.")).toBeInTheDocument();
    expect(screen.getAllByText("Discontinued").length).toBeGreaterThan(0);
  });

  it("says so when a product does not exist", async () => {
    renderApp("/products/999");
    expect(await screen.findByText("There is no product 999.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to products" })).toBeInTheDocument();
  });
});
