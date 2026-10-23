import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { value } from "./api-server";
import { recordRequests } from "./helpers";
import { renderApp } from "./render";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

describe("dashboard", () => {
  it("opens on the last twelve months, with the totals the server computes", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Sales dashboard" })).toBeInTheDocument();
    const revenue = Number(
      value(
        "SELECT round(sum(lines_total), 2) FROM orders WHERE substr(order_date, 1, 7) BETWEEN '2025-11' AND '2026-10'",
      ),
    );
    expect(await screen.findByText(money(revenue))).toBeInTheDocument();
    expect(screen.getByText("Nov 2025 to Oct 2026")).toBeInTheDocument();
  });

  it("lists the top product and the best-selling employee", async () => {
    renderApp("/");
    const top = String(
      value(
        "SELECT p.name FROM product_month_sales s JOIN products p USING (product_id) WHERE month BETWEEN '2025-11' AND '2026-10' GROUP BY s.product_id ORDER BY sum(s.revenue) DESC LIMIT 1",
      ),
    );
    const products = await screen.findByRole("table", { name: "Top products, by revenue" });
    expect(within(products).getAllByRole("row")[0]).toHaveTextContent(top);
    expect(screen.getByRole("table", { name: "Sales by employee, by revenue" })).toBeInTheDocument();
  });

  it("changes the range from the menus and keeps it in the address", async () => {
    const requests = recordRequests("/dashboard");
    const { user, location } = renderApp("/");
    await screen.findByText("Nov 2025 to Oct 2026");
    await user.selectOptions(screen.getByLabelText("From"), "2026-01");
    expect(await screen.findByText("Jan 2026 to Oct 2026")).toBeInTheDocument();
    expect(location().search).toMatchObject({ from: "2026-01" });
    expect(requests.at(-1)!.searchParams.get("from")).toBe("2026-01");
  });

  it("offers the monthly figures as a table", async () => {
    renderApp("/");
    await screen.findByText("Nov 2025 to Oct 2026");
    expect(screen.getByText("Show the figures as a table")).toBeInTheDocument();
    expect(screen.getAllByText("Oct 2026").length).toBeGreaterThan(0);
  });
});
