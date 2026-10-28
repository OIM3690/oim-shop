// A rep's chosen name is seen only by that rep and the managers; a manager's
// chosen name by everyone signed in. Everywhere else a rep is "Sales rep 12"
// and a manager "Sales manager 10", after their employee number. The test
// gives each person a name found nowhere in Northwind and reads every page
// of the API as each kind of viewer.
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { signInDirectly } from "../src/testing.ts";
import { as } from "./auth-helpers.ts";
import { freshDb, TEST_NOW } from "./helpers.ts";

const db = freshDb();
const app = createApp({ db, now: () => TEST_NOW, publicUrl: "http://localhost:5173" });

const manager = signInDirectly(db, 8001, "Magnolia", "manager");
const repA = signInDirectly(db, 8002, "Zephyrine");
const repB = signInDirectly(db, 8003, "Bartholomew");
const idOf = (name: string) =>
  Number(db.prepare("SELECT employee_id FROM employees WHERE first_name = ?").get(name)!.employee_id);
const [M, A, B] = [idOf("Magnolia"), idOf("Zephyrine"), idOf("Bartholomew")];

const order = {
  customer_id: "ALFKI",
  shipper_id: 1,
  required_date: "2026-11-05",
  freight: 1,
  lines: [{ product_id: 1, quantity: 1, discount: 0 }],
};
const placed = await app.request("/api/orders", as(repA, { method: "POST", json: order }));
const orderId = schemas.order.parse(await placed.json()).order_id;

const PATHS = [
  "/api/employees?per_page=100",
  "/api/employees?per_page=100&sort=name",
  "/api/employees/directory",
  `/api/employees/${M}`,
  `/api/employees/${A}`,
  `/api/employees/${B}`,
  "/api/orders?per_page=100",
  `/api/orders?employee_id=${A}`,
  `/api/orders/${orderId}`,
  "/api/dashboard",
  "/api/regions",
];

async function read(cookie: string | null, path: string) {
  const response = await app.request(path, cookie ? as(cookie) : {});
  expect(response.status, path).toBe(200);
  return response.text();
}

describe("a visitor", () => {
  it("sees no chosen name anywhere, only titles and numbers", async () => {
    for (const path of PATHS) {
      const text = await read(null, path);
      for (const name of ["Magnolia", "Zephyrine", "Bartholomew"]) expect(text, path).not.toContain(name);
    }
    const directory = schemas.directory.parse(JSON.parse(await read(null, "/api/employees/directory")));
    expect(directory.find((e) => e.employee_id === M)?.name).toBe(`Sales manager ${M}`);
    expect(directory.find((e) => e.employee_id === A)?.name).toBe(`Sales rep ${A}`);
    expect(directory.find((e) => e.employee_id === 1)?.name).toBe("Nancy Davolio");
    const b = schemas.employeeDetail.parse(JSON.parse(await read(null, `/api/employees/${B}`)));
    expect(b.manager_name).toBe(`Sales manager ${M}`);
  });
});

describe("a rep", () => {
  it("sees their own name and the manager's, and no other rep's", async () => {
    for (const path of [...PATHS, "/api/me/orders"]) {
      const text = await read(repB, path);
      expect(text, path).not.toContain("Zephyrine");
    }
    const directory = schemas.directory.parse(JSON.parse(await read(repB, "/api/employees/directory")));
    expect(directory.find((e) => e.employee_id === B)?.name).toBe("Bartholomew");
    expect(directory.find((e) => e.employee_id === M)?.name).toBe("Magnolia");
    expect(directory.find((e) => e.employee_id === A)?.name).toBe(`Sales rep ${A}`);
  });

  it("sees their own name on the orders they entered", async () => {
    const own = schemas.order.parse(JSON.parse(await read(repA, `/api/orders/${orderId}`)));
    expect(own.employee_name).toBe("Zephyrine");
    const me = schemas.me.parse(JSON.parse(await read(repA, "/api/me")));
    expect(me.employee?.name).toBe("Zephyrine");
  });
});

describe("a manager", () => {
  it("sees every rep's chosen name", async () => {
    const directory = schemas.directory.parse(JSON.parse(await read(manager, "/api/employees/directory")));
    expect(directory.find((e) => e.employee_id === A)?.name).toBe("Zephyrine");
    expect(directory.find((e) => e.employee_id === B)?.name).toBe("Bartholomew");
    const dashboard = schemas.dashboard.parse(JSON.parse(await read(manager, "/api/dashboard")));
    expect(dashboard.by_employee.find((e) => e.employee_id === A)?.name).toBe("Zephyrine");
  });

  it("sorts by the names they see", async () => {
    const page = schemas
      .pageOf(schemas.employee)
      .parse(JSON.parse(await read(manager, "/api/employees?per_page=100&sort=name")));
    const names = page.items.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(names).toContain("Bartholomew");
  });
});

describe("responses that depend on who is signed in", () => {
  it("are never stored by a shared cache", async () => {
    const response = await app.request("/api/employees/directory", as(manager));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
