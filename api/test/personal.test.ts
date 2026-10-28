// Northwind employees' personal details go only to people who are signed in.
// The server leaves them out of a visitor's response; hiding them in the
// browser would not be enough.
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { signInDirectly } from "../src/testing.ts";
import { freshDb, TEST_NOW } from "./helpers.ts";

const db = freshDb();
const app = createApp({ db, now: () => TEST_NOW });
const cookie = signInDirectly(db, 7001, "Ana");
const signedIn = { headers: { Cookie: cookie } };

const PERSONAL = ["1968-12-08", "507 - 20th Ave. E.Apt. 2A", "98122", "(206) 555-9857", "5467", "Education"];

describe("an employee's personal details", () => {
  it("are left out of a visitor's response", async () => {
    const response = await app.request("/api/employees/1");
    const text = await response.text();
    expect(schemas.employeeDetail.parse(JSON.parse(text)).personal).toBeNull();
    for (const value of PERSONAL) expect(text).not.toContain(value);
    expect(text).not.toContain("1972-08-10");
  });

  it("are sent to someone signed in, with the birth date on oim-api's clock", async () => {
    const response = await app.request("/api/employees/1", signedIn);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const nancy = schemas.employeeDetail.parse(await response.json());
    expect(nancy.personal).toMatchObject({
      birth_date: "1972-08-10",
      address: "507 - 20th Ave. E.Apt. 2A",
      region: "North America",
      postal_code: "98122",
      home_phone: "(206) 555-9857",
      extension: "5467",
      has_photo: true,
    });
    expect(nancy.personal?.notes).toMatch(/^Education includes a BA in psychology/);
  });

  it("are not in any list a visitor can read", async () => {
    for (const path of ["/api/employees?per_page=100", "/api/employees/directory", "/api/regions"]) {
      const text = await (await app.request(path)).text();
      for (const value of PERSONAL) expect(text).not.toContain(value);
    }
  });
});

describe("an employee's photo", () => {
  it("asks a visitor to sign in", async () => {
    expect((await app.request("/api/employees/1/photo")).status).toBe(401);
  });

  it("is a JPEG for someone signed in, never stored by a shared cache", async () => {
    const response = await app.request("/api/employees/1/photo", signedIn);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it("is 404 for a rep, who has none", async () => {
    expect((await app.request("/api/employees/10/photo", signedIn)).status).toBe(404);
  });
});
