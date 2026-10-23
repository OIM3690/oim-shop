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
