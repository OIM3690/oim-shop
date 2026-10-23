import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { server, signInAs, testDb, value } from "./api-server";
import { recordRequests } from "./helpers";
import { renderApp } from "./render";

const stock = (productId: number) =>
  Number(value("SELECT units_in_stock FROM products WHERE product_id = ?", productId));

describe("signing in", () => {
  it("offers sign-in with GitHub to a visitor", async () => {
    renderApp("/orders/new");
    expect(await screen.findByText("Sign in to enter orders.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign in with GitHub" })[0]).toHaveAttribute(
      "href",
      "/api/auth/github",
    );
  });

  it("asks a new rep to choose a name, then makes them a rep", async () => {
    signInAs(3001);
    const { user, location } = renderApp("/welcome");
    expect(await screen.findByRole("heading", { name: "Welcome to Northwind" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Display name"), "<b>");
    await user.click(screen.getByRole("button", { name: "Start as a sales rep" }));
    expect(await screen.findByText("Use letters, digits, spaces, and . ' - only")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveFocus();
    expect(screen.getByLabelText("Display name")).toHaveAccessibleDescription(
      /Use letters, digits, spaces, and \. ' - only$/,
    );

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Ana Ruiz");
    await user.click(screen.getByRole("button", { name: "Start as a sales rep" }));

    await waitFor(() => expect(location().pathname).toBe("/orders/new"));
    expect(value("SELECT first_name FROM employees WHERE user_id IS NOT NULL")).toBe("Ana Ruiz");
  });
});

describe("entering an order", () => {
  it("places an order, reserves the stock and opens the order", async () => {
    signInAs(3002, "Ana");
    const chai = stock(1);
    const { user, location } = renderApp("/orders/new");

    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await user.selectOptions(screen.getByLabelText("Product"), "Chai");
    const quantity = screen.getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, "10");
    expect(screen.getAllByText("$180.00").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Place order" }));

    await waitFor(() => expect(location().pathname).toMatch(/^\/orders\/1000000$/));
    expect(await screen.findByRole("heading", { name: "Order 1000000" })).toBeInTheDocument();
    expect(stock(1)).toBe(chai - 10);
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
  });

  it("shows a problem next to its field before sending anything", async () => {
    signInAs(3003, "Ana");
    const { user } = renderApp("/orders/new");
    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await user.selectOptions(screen.getByLabelText("Product"), "Chai");
    const quantity = screen.getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, "100000");
    const discount = screen.getByLabelText("Discount, %");
    await user.clear(discount);
    await user.type(discount, "30");

    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByText(/^Only [\d,]+ in stock$/)).toBeInTheDocument();
    expect(screen.getByText("Discount can be at most 25%")).toBeInTheDocument();
    expect(value("SELECT count(*) FROM orders WHERE entered_by_user IS NOT NULL")).toBe(0);
  });

  it("moves focus to the first field with a problem and ties the message to it", async () => {
    signInAs(3007, "Ana");
    const { user } = renderApp("/orders/new");
    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await user.selectOptions(screen.getByLabelText("Product"), "Chai");
    const quantity = screen.getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, "100000");

    await user.click(screen.getByRole("button", { name: "Place order" }));

    await waitFor(() => expect(quantity).toHaveFocus());
    expect(quantity).toHaveAccessibleDescription(/^Only [\d,]+ in stock$/);
  });

  it("puts the server's refusal on the field it names and moves focus there", async () => {
    signInAs(3008, "Ana");
    const { user } = renderApp("/orders/new");
    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await user.selectOptions(screen.getByLabelText("Product"), "Chai");
    const quantity = screen.getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, "5");
    // Someone else takes the stock after the form loaded the catalog.
    testDb().exec("UPDATE products SET units_in_stock = 1 WHERE product_id = 1");

    await user.click(screen.getByRole("button", { name: "Place order" }));

    await waitFor(() => expect(quantity).toHaveFocus());
    expect(quantity).toHaveAccessibleDescription("Only 1 of Chai in stock");
  });

  it("cancels the rep's own order after asking, and returns the stock", async () => {
    signInAs(3004, "Ana");
    const chai = stock(1);
    const { user, location } = renderApp("/orders/new");
    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await user.selectOptions(screen.getByLabelText("Product"), "Chai");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await screen.findByRole("heading", { name: "Order 1000000" });

    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel order" }));

    await waitFor(() => expect(location().pathname).toBe("/my-orders"));
    expect(stock(1)).toBe(chai);
    expect(await screen.findByText("You have not entered an order yet.")).toBeInTheDocument();
  });

  it("holds every action while a cancellation is on its way", async () => {
    signInAs(3006, "Ana");
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const cancels = recordRequests("/orders/1000000/cancel");
    // Answering nothing passes the request on to the real API once released.
    server.use(http.post("http://localhost:3000/api/orders/:id/cancel", async () => void (await held)));
    const { user, location } = renderApp("/orders/new");
    await user.selectOptions(await screen.findByLabelText("Customer"), "Alfreds Futterkiste");
    await user.selectOptions(screen.getByLabelText("Product"), "Chai");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await screen.findByRole("heading", { name: "Order 1000000" });

    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel order" }));

    expect(within(dialog).getByRole("button", { name: "Cancel order" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark shipped", hidden: true })).toBeDisabled();
    release();
    await waitFor(() => expect(location().pathname).toBe("/my-orders"));
    expect(cancels).toHaveLength(1);
  });

  it("does not offer changes on someone else's order", async () => {
    const db = testDb();
    signInAs(3005, "Ben");
    db.exec(`INSERT INTO orders (order_id, customer_id, employee_id, order_date, required_date, shipper_id, freight,
               entered_by_user, lines_total, line_count)
             VALUES (1000000, 'ALFKI', 5, '2026-10-22T10:00:00', '2026-11-01T00:00:00', 1, 0, NULL, 0, 0)`);
    renderApp("/orders/1000000");
    expect(await screen.findByRole("heading", { name: "Order 1000000" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });
});
