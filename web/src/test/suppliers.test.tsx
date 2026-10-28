import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { recordRequests, rows } from "./helpers";
import { renderApp } from "./render";

describe("suppliers", () => {
  it("lists the first page with the total", async () => {
    renderApp("/suppliers");
    expect(await screen.findByText("1–25 of 29")).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Exotic Liquids");
    expect(rows()[0]).toHaveTextContent("Charlotte Cooper");
  });

  it("searches by company name on the server", async () => {
    const requests = recordRequests("/suppliers");
    const { user } = renderApp("/suppliers");
    await screen.findByText("1–25 of 29");
    await user.type(screen.getByLabelText("Company name"), "exotic{Enter}");
    expect(await screen.findByText("1–1 of 1")).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("name")).toBe("exotic");
  });

  it("shows a supplier's contact, address and home page", async () => {
    renderApp("/suppliers/6");
    expect(await screen.findByRole("heading", { name: "Mayumi's", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Mayumi Ohno")).toBeInTheDocument();
    expect(screen.getByText("(06) 431-7877")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /microsoft\.com/ })).toHaveAttribute(
      "href",
      "http://www.microsoft.com/accessdev/sampleapps/mayumi.htm",
    );
  });

  it("is in the menu", async () => {
    renderApp("/products");
    const sections = await screen.findByRole("navigation", { name: "Sections" });
    expect(within(sections).getByRole("link", { name: "Suppliers" })).toBeInTheDocument();
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
