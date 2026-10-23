import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { signInAs } from "./api-server";
import { recordRequests } from "./helpers";
import { renderApp } from "./render";

/** The header cell around a column's sort button, as in "Sort by revenue". */
const columnHeader = (name: string) =>
  screen.getByRole("button", { name: `Sort by ${name.toLowerCase()}` }).closest("th");

describe("sortable columns", () => {
  it("keeps focus on the header you sorted with the keyboard", async () => {
    const { user, location } = renderApp("/products");
    await screen.findByText("1–25 of 77");
    const revenue = screen.getByRole("button", { name: "Sort by revenue" });
    revenue.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(location().search).toEqual({ sort: "-revenue" }));
    await screen.findByText("1–25 of 77");
    expect(screen.getByRole("button", { name: "Sort by revenue" })).toHaveFocus();
  });

  it("tells assistive technology which way each column is sorted", async () => {
    const { user } = renderApp("/products");
    await screen.findByText("1–25 of 77");
    expect(columnHeader("Revenue")).toHaveAttribute("aria-sort", "none");

    await user.click(screen.getByRole("button", { name: "Sort by revenue" }));
    await waitFor(() => expect(columnHeader("Revenue")).toHaveAttribute("aria-sort", "descending"));
    await user.click(screen.getByRole("button", { name: "Sort by revenue" }));
    await waitFor(() => expect(columnHeader("Revenue")).toHaveAttribute("aria-sort", "ascending"));
    expect(columnHeader("Product")).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("columnheader", { name: "Category" })).not.toHaveAttribute("aria-sort");
  });

  it("shows the default newest-first order on the Date column", async () => {
    renderApp("/orders");
    await screen.findByRole("table");
    expect(columnHeader("Date")).toHaveAttribute("aria-sort", "descending");
    expect(columnHeader("Total")).toHaveAttribute("aria-sort", "none");
  });

  it.each([
    ["a customer's orders", "/customers/ALFKI", "/orders"],
    ["an employee's orders", "/employees/5", "/orders"],
  ])("sorts %s on the server", async (_, path, apiPath) => {
    const requests = recordRequests(apiPath);
    const { user, location } = renderApp(path);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Sort by total" }));
    await waitFor(() => expect(location().search).toEqual({ sort: "-order_total" }));
    await waitFor(() =>
      expect(requests.some((url) => url.searchParams.get("sort") === "-order_total")).toBe(true),
    );
    expect(columnHeader("Total")).toHaveAttribute("aria-sort", "descending");
  });

  it("sorts your own orders on the server", async () => {
    signInAs(3201, "Ana");
    const requests = recordRequests("/me/orders");
    const { user, location } = renderApp("/orders/new");
    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await user.selectOptions(screen.getByLabelText("Product"), "Chai");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await screen.findByRole("heading", { name: "Order 1000000" });
    await user.click(screen.getByRole("link", { name: "My orders" }));
    await screen.findByRole("heading", { name: "My orders", level: 1 });
    await screen.findByRole("button", { name: "Sort by date" });

    await user.click(screen.getByRole("button", { name: "Sort by date" }));
    await waitFor(() => expect(location().search).toEqual({ sort: "order_date" }));
    await waitFor(() =>
      expect(requests.some((url) => url.searchParams.get("sort") === "order_date")).toBe(true),
    );
  });
});
