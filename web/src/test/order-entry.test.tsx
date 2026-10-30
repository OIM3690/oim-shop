import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { server, signInAs, testDb, value } from "./api-server";
import { recordRequests } from "./helpers";
import { renderApp } from "./render";
import { api } from "@/lib/api";

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

  it("says the account did not load, rather than asking a rep to sign in again", async () => {
    signInAs(3009, "Ana");
    server.use(http.get("http://localhost:3000/api/me", () => new Response(null, { status: 500 })));
    renderApp("/orders/new");
    expect(await screen.findByText("Your account did not load.")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to enter orders.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in with GitHub" })).not.toBeInTheDocument();
  });

  it("says the account did not load on the welcome page too", async () => {
    signInAs(3010);
    server.use(http.get("http://localhost:3000/api/me", () => new Response(null, { status: 500 })));
    renderApp("/welcome");
    expect(await screen.findByText("Your account did not load.")).toBeInTheDocument();
    expect(screen.queryByText("You are not signed in.")).not.toBeInTheDocument();
  });

  it("says so when signing out fails", async () => {
    signInAs(3011, "Ana");
    server.use(http.post("http://localhost:3000/api/auth/logout", () => new Response(null, { status: 500 })));
    const { user } = renderApp("/products");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Signing out did not work. Try again.")).toBeInTheDocument();
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

  it("tells a new rep they report to the sales manager", async () => {
    signInAs(3012);
    renderApp("/welcome");
    expect(
      await screen.findByText(/joining as a sales rep, reporting to the Sales Manager/),
    ).toBeInTheDocument();
  });

  it("tells a new manager they report to Andrew Fuller", async () => {
    signInAs(3013, undefined, "manager");
    renderApp("/welcome");
    expect(
      await screen.findByText(
        /joining as a sales manager, reporting to Andrew Fuller, Vice President, Sales/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start as a sales manager" })).toBeInTheDocument();
  });
});

describe("entering an order", () => {
  const ownOrder = async () => {
    signInAs(3020, "Ana");
    return api.placeOrder({
      customer_id: "ALFKI",
      shipper_id: 1,
      required_date: "2027-01-01",
      freight: 0,
      lines: [{ product_id: 1, quantity: 1, discount: 0 }],
    });
  };

  it("asks before shipping, lets the rep keep editing, and ships only after confirmation", async () => {
    const order = await ownOrder();
    const { user } = renderApp(`/orders/${order.order_id}`);
    const shipments = recordRequests(`/orders/${order.order_id}/ship`);
    const trigger = await screen.findByRole("button", { name: "Mark shipped" });
    await user.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleDescription(
      "You will no longer be able to edit or cancel this order. This cannot be undone.",
    );
    expect(shipments).toHaveLength(0);
    const keepEditing = within(dialog).getByRole("button", { name: "Keep editing" });
    expect(keepEditing).toHaveFocus();
    await user.click(keepEditing);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(value("SELECT shipped_date FROM orders WHERE order_id = ?", order.order_id)).toBeNull();

    await user.click(trigger);
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Mark shipped" }),
    );
    await waitFor(() => expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument());
    await waitFor(() =>
      expect(value("SELECT shipped_date FROM orders WHERE order_id = ?", order.order_id)).not.toBeNull(),
    );
    expect(shipments).toHaveLength(1);
  });

  it("holds the confirmation while shipping and allows retry after a failed shipment", async () => {
    const order = await ownOrder();
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post("http://localhost:3000/api/orders/:id/ship", async () => {
        await held;
        return new Response(null, { status: 500 });
      }),
    );
    const { user } = renderApp(`/orders/${order.order_id}`);
    await user.click(await screen.findByRole("button", { name: "Mark shipped" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Mark shipped" });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Keep editing" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel order", hidden: true })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(dialog).toBeInTheDocument();
    release();
    await screen.findByText("The API answered 500");
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(value("SELECT shipped_date FROM orders WHERE order_id = ?", order.order_id)).toBeNull();
    server.resetHandlers();
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(value("SELECT shipped_date FROM orders WHERE order_id = ?", order.order_id)).not.toBeNull();
  });

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

  it("offers to try again when the catalog does not load", async () => {
    signInAs(3012, "Ana");
    server.use(http.get("http://localhost:3000/api/shippers", () => new Response(null, { status: 500 })));
    renderApp("/orders/new");
    expect(await screen.findByText("The catalog did not load.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says an order to edit does not exist", async () => {
    signInAs(3013, "Ana");
    renderApp("/orders/1/edit");
    expect(await screen.findByText("There is no order 1.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
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
