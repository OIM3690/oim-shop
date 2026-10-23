import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { server, signInAs, testDb, value } from "./api-server";
import { recordRequests, rows } from "./helpers";
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

  it("pages the list on the server as reps join", async () => {
    const insert = testDb().prepare(
      "INSERT INTO employees (employee_id, first_name, last_name, title, reports_to, hire_date) VALUES (?, ?, '', 'Sales Representative', 5, '2026-10-01')",
    );
    for (let i = 0; i < 30; i++) insert.run(100 + i, `Rep ${i}`);
    const requests = recordRequests("/employees");
    const { user } = renderApp("/employees");
    expect(await screen.findByText("1–25 of 39")).toBeInTheDocument();
    expect(rows()).toHaveLength(25);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("26–39 of 39")).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("page")).toBe("2");
  });

  it("sorts by revenue on the server, largest first", async () => {
    const { user, location } = renderApp("/employees");
    await screen.findByText("1–9 of 9");
    await user.click(screen.getByRole("button", { name: "Sort by revenue" }));
    expect(location().search).toEqual({ sort: "-revenue" });
    const best = value(
      "SELECT trim(e.first_name || ' ' || e.last_name) FROM orders o JOIN employees e USING (employee_id) GROUP BY employee_id ORDER BY sum(o.lines_total) DESC LIMIT 1",
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent(String(best)));
  });

  it("shows an employee's manager and direct reports", async () => {
    renderApp("/employees/5");
    await screen.findByRole("heading", { name: "Steven Buchanan" });
    expect(screen.getByRole("link", { name: "Andrew Fuller" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Michael Suyama" })).toBeInTheDocument();
  });

  it("says the direct reports did not load, rather than None", async () => {
    server.use(
      http.get("http://localhost:3000/api/employees/directory", () => new Response(null, { status: 500 })),
    );
    renderApp("/employees/5");
    await screen.findByRole("heading", { name: "Steven Buchanan" });
    expect(await screen.findByText("Did not load.")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again: Direct reports" })).toBeInTheDocument();
  });
});
