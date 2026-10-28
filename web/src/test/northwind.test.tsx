import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { signInAs, value } from "./api-server";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

describe("suppliers", () => {
  it("lists the first page, with search by company name on the server", async () => {
    const requests = recordRequests("/suppliers");
    const { user } = renderApp("/suppliers");
    expect(await screen.findByText("1–25 of 29")).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Exotic Liquids");
    expect(rows()[0]).toHaveTextContent("Charlotte Cooper");

    await user.type(screen.getByLabelText("Company name"), "exotic{Enter}");
    expect(await screen.findByText("1–1 of 1")).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("name")).toBe("exotic");
  });

  it("shows a supplier's contact, home page and products", async () => {
    const requests = recordRequests("/products");
    renderApp("/suppliers/6");
    expect(await screen.findByRole("heading", { name: "Mayumi's", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /microsoft\.com/ })).toHaveAttribute(
      "href",
      "http://www.microsoft.com/accessdev/sampleapps/mayumi.htm",
    );
    const first = String(value("SELECT name FROM products WHERE supplier_id = 6 ORDER BY product_id"));
    expect(await screen.findByRole("link", { name: first })).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("supplier")).toBe("6");
  });

  it("is in the menu", async () => {
    renderApp("/products");
    const sections = await screen.findByRole("navigation", { name: "Sections" });
    expect(within(sections).getByRole("link", { name: "Suppliers" })).toBeInTheDocument();
    expect(within(sections).getByRole("link", { name: "Territories" })).toBeInTheDocument();
  });
});

describe("a customer's page", () => {
  it("shows the contact's title, the address, phone and fax", async () => {
    renderApp("/customers/ALFKI");
    expect(await screen.findByText("Sales Representative")).toBeInTheDocument();
    expect(screen.getByText("Obere Str. 57")).toBeInTheDocument();
    expect(screen.getByText("030-0074321")).toBeInTheDocument();
    expect(screen.getByText("030-0076545")).toBeInTheDocument();
  });
});

describe("a product's page", () => {
  it("shows units on order, the category's picture and a link to the supplier", async () => {
    renderApp("/products/2");
    expect(await screen.findByRole("heading", { name: "Chang", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Units on order").nextElementSibling).toHaveTextContent("40");
    expect(screen.getByRole("img", { name: "Beverages" })).toHaveAttribute(
      "src",
      "/api/categories/1/picture",
    );
    expect(screen.getByRole("link", { name: "Exotic Liquids" })).toHaveAttribute("href", "/suppliers/1");
  });
});

describe("an order's page", () => {
  it("shows the full ship-to and the shipper's phone", async () => {
    renderApp("/orders/10248");
    const shipTo = (await screen.findByText("Ship to")).nextElementSibling!;
    expect(shipTo).toHaveTextContent("Vins et alcools Chevalier");
    expect(shipTo).toHaveTextContent("59 rue de l-Abbaye");
    expect(shipTo).toHaveTextContent("Reims 51100");
    expect(shipTo).toHaveTextContent("France");
    expect(screen.getByText("Shipper").nextElementSibling).toHaveTextContent("Federal Shipping");
    expect(screen.getByText("Shipper").nextElementSibling).toHaveTextContent("(503) 555-9931");
  });
});

describe("territories", () => {
  it("lists each region's territories and who covers them", async () => {
    renderApp("/territories");
    expect(await screen.findByRole("heading", { name: "Eastern", level: 2 })).toBeInTheDocument();
    const westboro = screen.getByText("Westboro").closest("tr")!;
    expect(within(westboro).getByRole("link", { name: "Andrew Fuller" })).toHaveAttribute(
      "href",
      "/employees/2",
    );
  });
});

describe("an employee's page", () => {
  it("shows the title of courtesy and the territories to everyone", async () => {
    renderApp("/employees/1");
    expect(await screen.findByText("Title of courtesy")).toBeInTheDocument();
    expect(screen.getByText("Title of courtesy").nextElementSibling).toHaveTextContent("Ms.");
    expect(screen.getByText("Territories", { selector: "dt" }).nextElementSibling).toHaveTextContent(
      "Neward, Wilton",
    );
  });

  it("shows no personal details to a visitor", async () => {
    renderApp("/employees/1");
    await screen.findByText("Title of courtesy");
    expect(screen.queryByText("Home phone")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Photo of/ })).not.toBeInTheDocument();
  });

  it("shows the personal details and photo to someone signed in", async () => {
    signInAs(3201, "Ana");
    renderApp("/employees/1");
    expect(await screen.findByText("Home phone")).toBeInTheDocument();
    expect(screen.getByText("Home phone").nextElementSibling).toHaveTextContent("(206) 555-9857");
    expect(screen.getByText("Born").nextElementSibling).toHaveTextContent("Aug 10, 1972");
    expect(screen.getByText("Extension").nextElementSibling).toHaveTextContent("5467");
    expect(screen.getByText(/^Education includes a BA in psychology/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Photo of Nancy Davolio" })).toHaveAttribute(
      "src",
      "/api/employees/1/photo",
    );
  });
});
