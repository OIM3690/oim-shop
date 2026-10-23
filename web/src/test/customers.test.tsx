import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, data } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

describe("customers", () => {
  it("lists the first page with the total", async () => {
    renderApp("/customers");
    expect(await screen.findByText("1–25 of 93")).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Alfreds Futterkiste");
    expect(rows()[0]).toHaveTextContent("Germany");
  });

  it("searches by company name on the server", async () => {
    const requests = recordRequests("/customers");
    const { user } = renderApp("/customers");
    await screen.findByText("1–25 of 93");

    await user.type(screen.getByLabelText("Company name"), "markt{Enter}");

    expect(await screen.findByText("1–2 of 2")).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("name")).toBe("markt");
  });

  it("filters by country", async () => {
    const requests = recordRequests("/customers");
    const { user, location } = renderApp("/customers");
    await screen.findByText("1–25 of 93");

    await user.selectOptions(await screen.findByLabelText("Country"), "Germany");

    const germany = data.customers.filter((c) => c.country === "Germany").length;
    expect(await screen.findByText(`1–${germany} of ${germany}`)).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("country")).toBe("Germany");
    expect(location().search).toEqual({ country: "Germany" });
  });

  it("says when the data has no city or country", async () => {
    renderApp("/customers?name=it");
    await screen.findByText(/of \d+$/);
    const valon = rows().find((row) => row.textContent?.includes("Valon Hoti"));
    expect(valon).toHaveTextContent("Not recorded");
  });

  it("shows a customer with their orders", async () => {
    const requests = recordRequests("/orders");
    renderApp("/customers/ALFKI");

    expect(await screen.findByRole("heading", { name: "Alfreds Futterkiste" })).toBeInTheDocument();
    const count = data.orders.filter((o) => o.customer_id === "ALFKI").length;
    expect(await screen.findByText(`1–${count} of ${count}`)).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("customer_id")).toBe("ALFKI");
  });

  it("says so when a customer does not exist", async () => {
    renderApp("/customers/NOPE");
    expect(await screen.findByText("There is no customer NOPE.")).toBeInTheDocument();
  });

  it("explains an empty search and clears it", async () => {
    const { user, location } = renderApp("/customers?name=zzz");
    expect(await screen.findByText("No customers matching “zzz”.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByText("1–25 of 93")).toBeInTheDocument();
    expect(location().search).toEqual({});
  });

  it("shows an error when the list fails", async () => {
    server.use(http.get(`${API}/customers`, () => HttpResponse.json({}, { status: 500 })));
    renderApp("/customers");
    expect(await screen.findByText("The customer list did not load.")).toBeInTheDocument();
  });
});
