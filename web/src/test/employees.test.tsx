import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, data } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { recordRequests } from "./helpers";
import { renderApp } from "./render";

describe("employees", () => {
  it("lists every employee with who they report to", async () => {
    renderApp("/employees");
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(data.employees.length);
    const nancy = rows.find((row) => row.textContent?.includes("Nancy Davolio"));
    expect(nancy).toHaveTextContent("Andrew Fuller");
  });

  it("draws the reporting lines from the top", async () => {
    renderApp("/employees");
    const tree = await screen.findByRole("list", { name: "Reporting lines" });
    const items = within(tree).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/^Andrew Fuller/);
    const steven = items.find((item) => item.firstElementChild?.textContent?.startsWith("Steven Buchanan"));
    expect(within(steven!).getByText("Michael Suyama")).toBeInTheDocument();
  });

  it("shows an employee with their manager, reports and orders", async () => {
    const requests = recordRequests("/orders");
    renderApp("/employees/5");

    expect(await screen.findByRole("heading", { name: "Steven Buchanan" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Andrew Fuller" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Michael Suyama" })).toBeInTheDocument();

    const count = data.orders.filter((o) => o.employee_id === 5).length;
    expect(await screen.findByText(`1–${count} of ${count}`)).toBeInTheDocument();
    expect(requests.some((url) => url.searchParams.get("employee_id") === "5")).toBe(true);
  });

  it("notes orders dated before the hire date, when there are any", async () => {
    server.use(
      http.get(`${API}/orders`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (!params.has("to_date")) return undefined;
        return HttpResponse.json({
          items: [],
          pagination: { page: 1, per_page: 1, total: 312, pages: 312, has_next: true, has_prev: false },
        });
      }),
    );
    renderApp("/employees/1");
    expect(await screen.findByText(/312 of these orders are dated before the hire date/)).toBeInTheDocument();
  });

  it("adds no note when every order follows the hire date", async () => {
    renderApp("/employees/5");
    await screen.findByText(/^1–\d+ of \d+$/);
    expect(screen.queryByText(/dated before the hire date/)).not.toBeInTheDocument();
  });

  it("says so when an employee does not exist", async () => {
    renderApp("/employees/99");
    expect(await screen.findByText("There is no employee 99.")).toBeInTheDocument();
  });
});
