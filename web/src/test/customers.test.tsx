import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { value } from "./api-server";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

describe("customers", () => {
  it("lists the first page with orders and revenue", async () => {
    renderApp("/customers");
    expect(await screen.findByText("1–25 of 93")).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Alfreds Futterkiste");
    const orders = Number(value("SELECT count(*) FROM orders WHERE customer_id = 'ALFKI'"));
    expect(rows()[0]).toHaveTextContent(String(orders));
  });

  it("searches by company name and filters by country", async () => {
    const requests = recordRequests("/customers");
    const { user, location } = renderApp("/customers");
    await screen.findByText("1–25 of 93");

    await user.type(screen.getByLabelText("Company name"), "markt{Enter}");
    expect(await screen.findByText("1–2 of 2")).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText("Country"), "Germany");
    expect(await screen.findByText("1–1 of 1")).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("country")).toBe("Germany");
    expect(location().search).toEqual({ name: "markt", country: "Germany" });
  });

  it("sorts by number of orders", async () => {
    const { user } = renderApp("/customers");
    await screen.findByText("1–25 of 93");
    await user.click(screen.getByRole("button", { name: "Sort by orders" }));
    const top = String(
      value(
        "SELECT c.company_name FROM orders o JOIN customers c USING (customer_id) GROUP BY o.customer_id ORDER BY count(*) DESC, c.customer_id LIMIT 1",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sort by orders" }).closest("th")).toHaveAttribute(
        "aria-sort",
        "descending",
      ),
    );
    expect(await screen.findByText(top, { selector: "a" })).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent(top);
  });

  it("says when the data has no city or country", async () => {
    renderApp("/customers?name=it");
    await screen.findByText(/of \d+$/);
    const valon = rows().find((row) => row.textContent?.includes("Valon Hoti"));
    expect(valon).toHaveTextContent("Not recorded");
  });

  it("opens the customer whose ID ends in a space", async () => {
    const { user } = renderApp("/customers?name=it");
    await screen.findByText(/of \d+$/);
    const val2 = rows().find((row) => row.textContent?.includes("Val2"))!;
    await user.click(within(val2).getByRole("link", { name: "IT" }));
    expect(await screen.findByRole("heading", { name: "IT" })).toBeInTheDocument();
    const count = Number(value("SELECT count(*) FROM orders WHERE customer_id = 'Val2 '"));
    expect(await screen.findByText(`1–25 of ${count}`)).toBeInTheDocument();
  });

  it("says so when a customer does not exist", async () => {
    renderApp("/customers/NOPE");
    expect(await screen.findByText("There is no customer NOPE.")).toBeInTheDocument();
  });
});
