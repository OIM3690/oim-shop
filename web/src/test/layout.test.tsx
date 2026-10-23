import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signInAs } from "./api-server";
import { renderApp } from "./render";

describe("the menu on a phone", () => {
  const desktopWidth = window.innerWidth;
  beforeEach(() => Object.defineProperty(window, "innerWidth", { value: 390, configurable: true }));
  afterEach(() => Object.defineProperty(window, "innerWidth", { value: desktopWidth, configurable: true }));

  it("closes after you choose New order", async () => {
    signInAs(3101, "Ana");
    const { user, location } = renderApp("/products");
    await user.click(await screen.findByRole("button", { name: "Toggle Sidebar" }));
    const menu = await screen.findByRole("dialog");
    await user.click(await within(menu).findByRole("link", { name: "New order" }));

    await waitFor(() => expect(location().pathname).toBe("/orders/new"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("gives focus back to its button when it closes", async () => {
    const { user } = renderApp("/products");
    const toggle = await screen.findByRole("button", { name: "Toggle Sidebar" });
    await user.click(toggle);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toggle).toHaveFocus();
  });
});

describe("landmarks and headings", () => {
  it("has one main landmark", async () => {
    renderApp("/products");
    await screen.findByRole("heading", { name: "Products", level: 1 });
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("titles a page that does not exist with a level-one heading", async () => {
    renderApp("/no-such-page");
    expect(
      await screen.findByRole("heading", { name: "This page does not exist.", level: 1 }),
    ).toBeInTheDocument();
  });

  it("titles a record that does not exist with a level-one heading", async () => {
    renderApp("/customers/NOPE");
    expect(
      await screen.findByRole("heading", { name: "There is no customer NOPE.", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("section headings", () => {
  it("makes each dashboard section a level-two heading", async () => {
    renderApp("/");
    for (const name of ["Revenue by month", "Top products", "Sales by employee", "Sales by country"]) {
      expect(await screen.findByRole("heading", { name, level: 2 })).toBeInTheDocument();
    }
  });
});

describe("a page number past the end", () => {
  it.each([
    ["/products?page=99", "1–25 of 77"],
    ["/customers/ALFKI?page=99", /^1–\d+ of \d+$/],
    ["/employees?page=99", "1–9 of 9"],
  ])("%s says so and offers page 1", async (path, firstPage) => {
    const { user } = renderApp(path);
    expect(await screen.findByText("Page 99 is past the end of this list.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to page 1" }));
    expect(await screen.findByText(firstPage)).toBeInTheDocument();
  });
});

describe("the privacy page", () => {
  it("explains the page counts when the server adds the Umami tag", async () => {
    const tag = document.createElement("script");
    tag.dataset.websiteId = "0b7f4c1e-0000-4000-8000-000000000000";
    document.head.append(tag);
    try {
      renderApp("/privacy");
      expect(await screen.findByText(/counts page views with Umami/)).toBeInTheDocument();
    } finally {
      tag.remove();
    }
  });

  it("says nothing about page counts where none are taken", async () => {
    renderApp("/privacy");
    await screen.findByRole("heading", { name: "Privacy", level: 1 });
    expect(screen.queryByText(/Umami/)).not.toBeInTheDocument();
  });
});
