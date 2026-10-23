import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { value } from "./api-server";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

const total = () => Number(value("SELECT count(*) FROM orders"));
const count = (n: number) => n.toLocaleString("en-US");

describe("orders", () => {
  it("lists the newest orders first with the total", async () => {
    renderApp("/orders");
    expect(await screen.findByText(`1–25 of ${count(total())}`)).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("21646");
  });

  it("filters by employee on the server", async () => {
    const requests = recordRequests("/orders");
    const { user, location } = renderApp("/orders");
    await screen.findByText(`1–25 of ${count(total())}`);
    await user.selectOptions(await screen.findByLabelText("Employee"), "Steven Buchanan");
    const n = Number(value("SELECT count(*) FROM orders WHERE employee_id = 5"));
    expect(await screen.findByText(`1–25 of ${count(n)}`)).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("employee_id")).toBe("5");
    expect(location().search).toEqual({ employee: 5 });
  });

  it("filters by date range, both days included", async () => {
    renderApp("/orders?from=2026-10-20&to=2026-10-21");
    const n = Number(
      value(
        "SELECT count(*) FROM orders WHERE substr(order_date, 1, 10) BETWEEN '2026-10-20' AND '2026-10-21'",
      ),
    );
    expect(await screen.findByText(`1–${n} of ${n}`)).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-20");
  });

  it("sorts by total, largest first", async () => {
    const { user, location } = renderApp("/orders");
    await screen.findByText(`1–25 of ${count(total())}`);
    await user.click(screen.getByRole("button", { name: "Sort by total" }));
    expect(location().search).toEqual({ sort: "-order_total" });
    const biggest = String(value("SELECT order_id FROM orders ORDER BY lines_total DESC LIMIT 1"));
    expect(await screen.findByRole("link", { name: biggest })).toBeInTheDocument();
  });

  it("explains filters that match nothing and clears them", async () => {
    const { user, location } = renderApp("/orders?from=2030-01-01");
    expect(await screen.findByText("No orders match these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText(`1–25 of ${count(total())}`)).toBeInTheDocument();
    expect(location().search).toEqual({});
  });

  it("shows an order with its lines and totals", async () => {
    renderApp("/orders/21646");
    expect(await screen.findByRole("heading", { name: "Order 21646" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IT" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Michael Suyama" })).toBeInTheDocument();
    const lines = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(lines).toHaveLength(6);
    expect(screen.getByText("$2,743.65")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });

  it("says so when an order does not exist", async () => {
    renderApp("/orders/1");
    expect(await screen.findByText("There is no order 1.")).toBeInTheDocument();
  });

  it("flags a date range that ends before it starts, without asking the server", async () => {
    const requests = recordRequests("/orders");
    renderApp("/orders?from=2026-10-10&to=2026-10-01");
    expect(await screen.findByText("The From date is after the To date.")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveAccessibleDescription("The From date is after the To date.");
    expect(requests).toHaveLength(0);
  });
});
