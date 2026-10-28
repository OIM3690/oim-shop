// The columns and tables everyone may read: contacts, suppliers, shippers'
// phones, category pictures, units on order, full ship-to, regions and
// territories, and titles of courtesy.
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

const db = freshDb();
const app = createApp({ db, now: () => TEST_NOW });

async function get(path: string) {
  const response = await app.request(path);
  return { status: response.status, body: (await response.json()) as unknown };
}

describe("customers", () => {
  it("include the contact's title, the address, phone and fax", async () => {
    const alfki = schemas.customer.parse((await get("/api/customers/ALFKI")).body);
    expect(alfki).toMatchObject({
      contact_name: "Maria Anders",
      contact_title: "Sales Representative",
      address: "Obere Str. 57",
      region: "Western Europe",
      postal_code: "12209",
      phone: "030-0074321",
      fax: "030-0076545",
    });
  });
});

describe("suppliers", () => {
  it("lists a page with the total and each supplier's number of products", async () => {
    const page = schemas.pageOf(schemas.supplier).parse((await get("/api/suppliers")).body);
    expect(page.pagination.total).toBe(29);
    expect(page.items[0]).toMatchObject({
      supplier_id: 1,
      name: "Exotic Liquids",
      contact_name: "Charlotte Cooper",
      contact_title: "Purchasing Manager",
      city: "London",
      country: "UK",
      phone: "(171) 555-2222",
      home_page: null,
      product_count: 3,
    });
  });

  it("filters by part of the name and by country, and sorts on the server", async () => {
    const byName = schemas.pageOf(schemas.supplier).parse((await get("/api/suppliers?name=EXOTIC")).body);
    expect(byName.items.map((s) => s.supplier_id)).toEqual([1]);
    const usa = schemas.pageOf(schemas.supplier).parse((await get("/api/suppliers?country=usa")).body);
    expect(usa.pagination.total).toBe(one(db, "SELECT count(*) AS n FROM suppliers WHERE country = 'USA'").n);
    const sorted = schemas
      .pageOf(schemas.supplier)
      .parse((await get("/api/suppliers?sort=-product_count&per_page=1")).body);
    const most = one(
      db,
      "SELECT supplier_id FROM products GROUP BY supplier_id ORDER BY count(*) DESC, supplier_id LIMIT 1",
    ).supplier_id;
    expect(sorted.items[0]!.supplier_id).toBe(most);
  });

  it("returns one supplier with its home page, or 404", async () => {
    const mayumi = schemas.supplier.parse((await get("/api/suppliers/6")).body);
    expect(mayumi.home_page).toBe("http://www.microsoft.com/accessdev/sampleapps/mayumi.htm");
    expect((await get("/api/suppliers/999")).status).toBe(404);
  });

  it("filters the product list by supplier, on the server", async () => {
    const page = schemas.pageOf(schemas.product).parse((await get("/api/products?supplier=1")).body);
    expect(page.items.map((p) => p.product_id)).toEqual([1, 2, 3]);
    expect(page.items[0]).toMatchObject({ supplier_id: 1, supplier: "Exotic Liquids" });
  });
});

describe("products", () => {
  it("include the units on order", async () => {
    const chang = schemas.product.parse((await get("/api/products/2")).body);
    expect(chang.units_on_order).toBe(40);
  });
});

describe("categories", () => {
  it("serve each picture as a JPEG", async () => {
    const response = await app.request("/api/categories/1/picture");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect((await app.request("/api/categories/99/picture")).status).toBe(404);
  });
});

describe("shippers", () => {
  it("include the phone", async () => {
    const shippers = schemas.shipper.array().parse((await get("/api/shippers")).body);
    expect(shippers[0]).toEqual({ shipper_id: 1, name: "Speedy Express", phone: "(503) 555-9831" });
  });
});

describe("orders", () => {
  it("carry the full ship-to and the shipper's phone", async () => {
    const order = schemas.order.parse((await get("/api/orders/10248")).body);
    expect(order).toMatchObject({
      ship_name: "Vins et alcools Chevalier",
      ship_address: "59 rue de l-Abbaye",
      ship_city: "Reims",
      ship_region: "Western Europe",
      ship_postal_code: "51100",
      ship_country: "France",
      shipper: "Federal Shipping",
      shipper_phone: "(503) 555-9931",
    });
  });
});

describe("regions and territories", () => {
  it("lists every region with its territories and who covers each", async () => {
    const regions = schemas.regions.parse((await get("/api/regions")).body);
    expect(regions.map((r) => r.name)).toEqual(["Eastern", "Western", "Northern", "Southern"]);
    const territories = regions.flatMap((r) => r.territories);
    expect(territories).toHaveLength(53);
    expect(territories.find((t) => t.territory_id === "01581")).toEqual({
      territory_id: "01581",
      name: "Westboro",
      employees: [{ employee_id: 2, name: "Andrew Fuller" }],
    });
    // Four territories have no one assigned in the source.
    expect(territories.filter((t) => t.employees.length === 0)).toHaveLength(4);
  });
});

describe("employees", () => {
  it("include the title of courtesy and the territories", async () => {
    const nancy = schemas.employeeDetail.parse((await get("/api/employees/1")).body);
    expect(nancy.title_of_courtesy).toBe("Ms.");
    expect(nancy.territories).toEqual([
      { territory_id: "06897", name: "Wilton", region: "Eastern" },
      { territory_id: "19713", name: "Neward", region: "Eastern" },
    ]);
  });
});
