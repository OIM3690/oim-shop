import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { data } from "@/mocks/handlers";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

const total = data.orders.length;

describe("orders", () => {
  it("lists the newest orders first with the total", async () => {
    renderApp("/orders");
    expect(await screen.findByText(`1–25 of ${total}`)).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent(String(data.orders[0].order_id));
  });

  it("filters by employee on the server", async () => {
    const requests = recordRequests("/orders");
    const { user, location } = renderApp("/orders");
    await screen.findByText(`1–25 of ${total}`);

    await user.selectOptions(await screen.findByLabelText("Employee"), "Steven Buchanan");

    const count = data.orders.filter((o) => o.employee_id === 5).length;
    expect(await screen.findByText(`1–${count} of ${count}`)).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("employee_id")).toBe("5");
    expect(location().search).toEqual({ employee: 5 });
  });

  it("filters by customer and by country", async () => {
    const requests = recordRequests("/orders");
    const { user } = renderApp("/orders");
    await screen.findByText(`1–25 of ${total}`);

    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await screen.findByText(/^1–\d+ of \d+$/);
    expect(requests.at(-1)!.searchParams.get("customer_id")).toBe("ALFKI");

    await user.selectOptions(screen.getByLabelText("Ship to country"), "Germany");
    await screen.findByText(/^1–\d+ of \d+$/);
    expect(requests.at(-1)!.searchParams.get("country")).toBe("Germany");
    expect(requests.at(-1)!.searchParams.get("customer_id")).toBe("ALFKI");
  });

  it("filters by date range", async () => {
    const requests = recordRequests("/orders");
    renderApp("/orders?from=2026-10-20&to=2026-10-21");

    const count = data.orders.filter(
      (o) => o.order_date.slice(0, 10) >= "2026-10-20" && o.order_date.slice(0, 10) <= "2026-10-21",
    ).length;
    expect(await screen.findByText(`1–${count} of ${count}`)).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("from_date")).toBe("2026-10-20");
    expect(requests.at(-1)!.searchParams.get("to_date")).toBe("2026-10-21");
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-20");
  });

  it("explains filters that match nothing and clears them", async () => {
    const { user, location } = renderApp("/orders?from=2030-01-01");
    expect(await screen.findByText("No orders match these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText(`1–25 of ${total}`)).toBeInTheDocument();
    expect(location().search).toEqual({});
  });

  it("shows an order with its lines and totals", async () => {
    const order = data.orders.find((o) => o.order_id === 21646)!;
    renderApp("/orders/21646");

    expect(await screen.findByRole("heading", { name: "Order 21646" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IT" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Michael Suyama" })).toBeInTheDocument();
    expect(screen.getAllByText("Not shipped").length).toBeGreaterThan(0);

    const lines = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(lines).toHaveLength(order.line_count);
    expect(screen.getByText("$2,743.65")).toBeInTheDocument();
    expect(screen.getByText("$48.75")).toBeInTheDocument();
  });

  it("says so when an order does not exist", async () => {
    renderApp("/orders/1");
    expect(await screen.findByText("There is no order 1.")).toBeInTheDocument();
  });
});
