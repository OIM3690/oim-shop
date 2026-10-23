import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { signInAs, value } from "./api-server";
import { recordRequests } from "./helpers";
import { renderApp } from "./render";

describe("employees", () => {
  it("lists every employee with manager, orders and revenue", async () => {
    renderApp("/employees");
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(9);
    const nancy = rows.find((row) => row.textContent?.includes("Nancy Davolio"))!;
    expect(nancy).toHaveTextContent("Andrew Fuller");
    expect(nancy).toHaveTextContent(
      Number(value("SELECT count(*) FROM orders WHERE employee_id = 1")).toLocaleString("en-US"),
    );
  });

  it("draws the reporting lines from the top, with new reps under Steven Buchanan", async () => {
    signInAs(2001, "Ana");
    renderApp("/employees");
    const tree = await screen.findByRole("list", { name: "Reporting lines" });
    const items = within(tree).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/^Andrew Fuller/);
    const steven = items.find((item) => item.firstElementChild?.textContent?.startsWith("Steven Buchanan"))!;
    expect(within(steven).getByText("Michael Suyama")).toBeInTheDocument();
    expect(within(steven).getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("New rep")).toBeInTheDocument();
  });

  it("shows an employee with their orders, and notes orders before the hire date", async () => {
    const requests = recordRequests("/orders");
    renderApp("/employees/9");
    expect(await screen.findByRole("heading", { name: "Anne Dodsworth" })).toBeInTheDocument();
    const before = Number(
      value(
        "SELECT count(*) FROM orders o JOIN employees e USING (employee_id) WHERE e.employee_id = 9 AND substr(o.order_date, 1, 10) < e.hire_date",
      ),
    );
    expect(before).toBeGreaterThan(0);
    expect(
      await screen.findByText(new RegExp(`^${before} of these orders are dated before the hire date`)),
    ).toBeInTheDocument();
    expect(requests.some((url) => url.searchParams.get("employee_id") === "9")).toBe(true);
  });

  it("says so when an employee does not exist", async () => {
    renderApp("/employees/99");
    expect(await screen.findByText("There is no employee 99.")).toBeInTheDocument();
  });
});
