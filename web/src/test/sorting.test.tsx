import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";

/** The header cell around a column's sort button, as in "Sort by revenue". */
const columnHeader = (name: string) =>
  screen.getByRole("button", { name: `Sort by ${name.toLowerCase()}` }).closest("th");

describe("sortable columns", () => {
  it("keeps focus on the header you sorted with the keyboard", async () => {
    const { user, location } = renderApp("/products");
    await screen.findByText("1–25 of 77");
    const revenue = screen.getByRole("button", { name: "Sort by revenue" });
    revenue.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(location().search).toEqual({ sort: "-revenue" }));
    await screen.findByText("1–25 of 77");
    expect(screen.getByRole("button", { name: "Sort by revenue" })).toHaveFocus();
  });

  it("tells assistive technology which way each column is sorted", async () => {
    const { user } = renderApp("/products");
    await screen.findByText("1–25 of 77");
    expect(columnHeader("Revenue")).toHaveAttribute("aria-sort", "none");

    await user.click(screen.getByRole("button", { name: "Sort by revenue" }));
    await waitFor(() => expect(columnHeader("Revenue")).toHaveAttribute("aria-sort", "descending"));
    await user.click(screen.getByRole("button", { name: "Sort by revenue" }));
    await waitFor(() => expect(columnHeader("Revenue")).toHaveAttribute("aria-sort", "ascending"));
    expect(columnHeader("Product")).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("columnheader", { name: "Category" })).not.toHaveAttribute("aria-sort");
  });

  it("shows the default newest-first order on the Date column", async () => {
    renderApp("/orders");
    await screen.findByRole("table");
    expect(columnHeader("Date")).toHaveAttribute("aria-sort", "descending");
    expect(columnHeader("Total")).toHaveAttribute("aria-sort", "none");
  });
});
