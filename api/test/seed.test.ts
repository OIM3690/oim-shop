import { describe, expect, it } from "vitest";
import { hyperlinkAddress } from "../src/northwind.ts";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

describe("seed", () => {
  const db = freshDb();

  it("loads the reference tables whole", () => {
    expect(one(db, "SELECT count(*) AS n FROM products").n).toBe(77);
    expect(one(db, "SELECT count(*) AS n FROM customers").n).toBe(93);
    expect(one(db, "SELECT count(*) AS n FROM employees").n).toBe(9);
  });

  it("moves every date onto oim-api's clock", () => {
    // Order 10248 is dated 2016-07-04 in the source; oim-api shows 2020-03-06.
    const order = one(
      db,
      "SELECT order_date, required_date, shipped_date FROM orders WHERE order_id = 10248",
    );
    expect(order).toEqual({
      order_date: "2020-03-06T00:00:00",
      required_date: "2020-04-03T00:00:00",
      shipped_date: "2020-03-18T00:00:00",
    });
    // Nancy Davolio was hired 2012-05-01 in the source; oim-api shows 2016-01-02.
    expect(one(db, "SELECT hire_date FROM employees WHERE employee_id = 1").hire_date).toBe("2016-01-02");
  });

  it("keeps only the orders placed by now", () => {
    expect(one(db, "SELECT max(order_date) AS d FROM orders").d! <= TEST_NOW).toBe(true);
    const kept = one(db, "SELECT count(*) AS n FROM orders").n as number;
    const all = one(db, "SELECT count(*) AS n FROM seed_orders").n as number;
    expect(kept).toBeGreaterThan(15000);
    expect(kept).toBeLessThan(all);
    expect(
      one(
        db,
        "SELECT count(*) AS n FROM order_lines l LEFT JOIN orders o USING (order_id) WHERE o.order_id IS NULL",
      ).n,
    ).toBe(0);
  });

  it("leaves a shipment that is still in the future unshipped", () => {
    // Order 21646 was placed at 14:59 on the test day and ships later.
    expect(one(db, "SELECT shipped_date FROM orders WHERE order_id = 21646").shipped_date).toBeNull();
    expect(one(db, "SELECT count(*) AS n FROM orders WHERE shipped_date > ?", TEST_NOW).n).toBe(0);
  });

  it("stores each order's lines total, as oim-api reports it", () => {
    expect(one(db, "SELECT lines_total, line_count FROM orders WHERE order_id = 10248")).toEqual({
      lines_total: 440,
      line_count: 3,
    });
    expect(one(db, "SELECT lines_total FROM orders WHERE order_id = 21646").lines_total).toBe(2743.65);
  });

  it("builds monthly product revenue that adds up to every line", () => {
    // Each line is rounded to the cent first, as oim-api's line_total_dollars is.
    const fromLines = one(
      db,
      "SELECT round(sum(round(unit_price * quantity * (1 - discount), 2)), 2) AS r FROM order_lines",
    ).r;
    const fromRollup = one(db, "SELECT round(sum(revenue), 2) AS r FROM product_month_sales").r;
    expect(fromRollup).toBe(fromLines);
  });

  it("keeps every table of Northwind but the empty ones", () => {
    expect(one(db, "SELECT count(*) AS n FROM regions").n).toBe(4);
    expect(one(db, "SELECT count(*) AS n FROM territories").n).toBe(53);
    expect(one(db, "SELECT count(*) AS n FROM employee_territories").n).toBe(49);
  });

  it("keeps the contact columns of customers, suppliers and shippers", () => {
    expect(
      one(
        db,
        "SELECT contact_title, address, region, postal_code, phone, fax FROM customers WHERE customer_id = 'ALFKI'",
      ),
    ).toEqual({
      contact_title: "Sales Representative",
      address: "Obere Str. 57",
      region: "Western Europe",
      postal_code: "12209",
      phone: "030-0074321",
      fax: "030-0076545",
    });
    expect(one(db, "SELECT contact_name, phone FROM suppliers WHERE supplier_id = 1")).toEqual({
      contact_name: "Charlotte Cooper",
      phone: "(171) 555-2222",
    });
    expect(one(db, "SELECT phone FROM shippers WHERE shipper_id = 1").phone).toBe("(503) 555-9831");
  });

  it("keeps a supplier's home page only when it is a web address", () => {
    const pages = Object.fromEntries(
      db
        .prepare("SELECT supplier_id, home_page FROM suppliers WHERE supplier_id IN (1, 2, 6, 12, 18, 24)")
        .all()
        .map((r) => [r.supplier_id, r.home_page]),
    );
    expect(pages).toEqual({
      1: null,
      2: null, // "#CAJUN.HTM#", a file in the Access database
      6: "http://www.microsoft.com/accessdev/sampleapps/mayumi.htm",
      12: "http://www.microsoft.com/accessdev/sampleapps/plutzer.htm",
      18: null, // "#FORMAGGI.HTM#"
      24: "http://www.microsoft.com/accessdev/sampleapps/gdaymate.htm",
    });
  });

  it("keeps products' units on order and the category pictures", () => {
    expect(one(db, "SELECT units_on_order FROM products WHERE product_id = 2").units_on_order).toBe(40);
    const picture = one(db, "SELECT picture FROM categories WHERE category_id = 1").picture as Uint8Array;
    expect([...picture.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]); // a JPEG
  });

  it("keeps each order's full ship-to", () => {
    expect(
      one(
        db,
        "SELECT ship_name, ship_address, ship_city, ship_region, ship_postal_code, ship_country FROM orders WHERE order_id = 10248",
      ),
    ).toEqual({
      ship_name: "Vins et alcools Chevalier",
      ship_address: "59 rue de l-Abbaye",
      ship_city: "Reims",
      ship_region: "Western Europe",
      ship_postal_code: "51100",
      ship_country: "France",
    });
  });

  it("keeps the employees' details, with the birth date on oim-api's clock", () => {
    const nancy = one(
      db,
      `SELECT title_of_courtesy, birth_date, address, region, postal_code, home_phone, extension,
         length(photo) > 0 AS has_photo, substr(notes, 1, 20) AS notes FROM employees WHERE employee_id = 1`,
    );
    expect(nancy).toEqual({
      title_of_courtesy: "Ms.",
      birth_date: "1972-08-10", // 1968-12-08 in the source
      address: "507 - 20th Ave. E.Apt. 2A",
      region: "North America",
      postal_code: "98122",
      home_phone: "(206) 555-9857",
      extension: "5467",
      has_photo: 1,
      notes: "Education includes a",
    });
    const columns = db
      .prepare("SELECT name FROM pragma_table_info('employees')")
      .all()
      .map((r) => r.name);
    expect(columns).not.toContain("photo_path");
  });
});

describe("an Access hyperlink", () => {
  it.each([
    ["#CAJUN.HTM#", null],
    ["#FORMAGGI.HTM#", null],
    [
      "Mayumi's (on the World Wide Web)#http://www.microsoft.com/accessdev/sampleapps/mayumi.htm#",
      "http://www.microsoft.com/accessdev/sampleapps/mayumi.htm",
    ],
    ["Plain text", null],
    [null, null],
  ])("%s gives %s", (text, address) => {
    expect(hyperlinkAddress(text)).toBe(address);
  });
});
