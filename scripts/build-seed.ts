// Builds data/seed/*.sql from the Northwind database in jpwhite3/northwind-SQLite3,
// pinned to one commit and checked by its SHA-256, so the seed can always be
// rebuilt exactly. Run it with `node scripts/build-seed.ts`; nothing else
// needs it.
//
// Dates are written as the source has them, normalized to YYYY-MM-DDTHH:MM:SS.
// The app moves them onto oim-api's shifted clock when it loads the seed.
// Every table and column is kept except the two empty tables
// (CustomerDemographics, CustomerCustomerDemo), the stored queries, and the
// employees' PhotoPath, an address on a network that no longer exists. The
// photos and category pictures themselves are JPEG files, kept as blobs.
// Employees' personal details are fictional; the app shows them only to
// people who are signed in.
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const COMMIT = "4f56e7f5906dfd23b25244c5bfe8fb5da6402efd";
const SHA256 = "2f4f5c68dfcd33ba27373eae48c7a4869800c68095ee0f9f0da494f83382a877";
const SOURCE = `https://raw.githubusercontent.com/jpwhite3/northwind-SQLite3/${COMMIT}/dist/northwind.db`;
const OUT = new URL("../data/seed/", import.meta.url);
const ROWS_PER_INSERT = 500;

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const digest = createHash("sha256").update(bytes).digest("hex");
if (digest !== SHA256) throw new Error(`Unexpected SHA-256 ${digest}`);

const path = join(mkdtempSync(join(tmpdir(), "northwind-")), "northwind.db");
writeFileSync(path, bytes);
const source = new DatabaseSync(path, { readOnly: true });

// "2016-07-04" and "2023-02-18 20:42:18" both become "2016-07-04T00:00:00" style.
const isoDate = (column: string) =>
  `CASE WHEN ${column} IS NULL THEN NULL WHEN length(${column}) = 10 THEN ${column} || 'T00:00:00' ELSE replace(${column}, ' ', 'T') END`;

const tables: { name: string; columns: string[]; select: string }[] = [
  {
    name: "categories",
    columns: ["category_id", "name", "description", "picture"],
    select: "SELECT CategoryID, CategoryName, Description, Picture FROM Categories ORDER BY 1",
  },
  {
    name: "suppliers",
    columns: [
      "supplier_id",
      "name",
      "contact_name",
      "contact_title",
      "address",
      "city",
      "region",
      "postal_code",
      "country",
      "phone",
      "fax",
      "home_page",
    ],
    select: `SELECT SupplierID, CompanyName, ContactName, ContactTitle, Address, City, Region, PostalCode,
      Country, Phone, Fax, HomePage FROM Suppliers ORDER BY 1`,
  },
  {
    name: "shippers",
    columns: ["shipper_id", "name", "phone"],
    select: "SELECT ShipperID, CompanyName, Phone FROM Shippers ORDER BY 1",
  },
  {
    name: "products",
    columns: [
      "product_id",
      "name",
      "supplier_id",
      "category_id",
      "quantity_per_unit",
      "unit_price",
      "units_in_stock",
      "units_on_order",
      "reorder_level",
      "discontinued",
    ],
    select: `SELECT ProductID, ProductName, SupplierID, CategoryID, QuantityPerUnit, UnitPrice,
      UnitsInStock, UnitsOnOrder, ReorderLevel, CAST(Discontinued AS INTEGER) FROM Products ORDER BY 1`,
  },
  {
    name: "customers",
    columns: [
      "customer_id",
      "company_name",
      "contact_name",
      "contact_title",
      "address",
      "city",
      "region",
      "postal_code",
      "country",
      "phone",
      "fax",
    ],
    select: `SELECT CustomerID, CompanyName, ContactName, ContactTitle, Address, City, Region, PostalCode,
      Country, Phone, Fax FROM Customers ORDER BY 1`,
  },
  {
    name: "employees",
    columns: [
      "employee_id",
      "first_name",
      "last_name",
      "title",
      "title_of_courtesy",
      "reports_to",
      "birth_date",
      "hire_date",
      "address",
      "city",
      "region",
      "postal_code",
      "country",
      "home_phone",
      "extension",
      "photo",
      "notes",
    ],
    select: `SELECT EmployeeID, FirstName, LastName, Title, TitleOfCourtesy, ReportsTo, substr(BirthDate, 1, 10),
      substr(HireDate, 1, 10), Address, City, Region, PostalCode, Country, HomePhone, Extension, Photo, Notes
      FROM Employees ORDER BY 1`,
  },
  {
    name: "orders",
    columns: [
      "order_id",
      "customer_id",
      "employee_id",
      "order_date",
      "required_date",
      "shipped_date",
      "shipper_id",
      "freight",
      "ship_name",
      "ship_address",
      "ship_city",
      "ship_region",
      "ship_postal_code",
      "ship_country",
    ],
    select: `SELECT OrderID, CustomerID, EmployeeID, ${isoDate("OrderDate")}, ${isoDate("RequiredDate")},
      ${isoDate("ShippedDate")}, ShipVia, Freight, ShipName, ShipAddress, ShipCity, ShipRegion, ShipPostalCode,
      ShipCountry FROM Orders ORDER BY 1`,
  },
  {
    name: "order_lines",
    columns: ["order_id", "product_id", "unit_price", "quantity", "discount"],
    select: `SELECT OrderID, ProductID, UnitPrice, Quantity, Discount FROM "Order Details" ORDER BY 1, 2`,
  },
  {
    name: "regions",
    columns: ["region_id", "name"],
    select: "SELECT RegionID, RegionDescription FROM Regions ORDER BY 1",
  },
  {
    name: "territories",
    columns: ["territory_id", "name", "region_id"],
    select: "SELECT TerritoryID, TerritoryDescription, RegionID FROM Territories ORDER BY 1",
  },
  {
    name: "employee_territories",
    columns: ["employee_id", "territory_id"],
    select: "SELECT EmployeeID, TerritoryID FROM EmployeeTerritories ORDER BY 1, 2",
  },
];

const literal = (value: unknown) => {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString("hex")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
};

for (const table of tables) {
  const rows = source.prepare(table.select).all();
  const lines = [
    `-- ${table.name}: ${rows.length} rows from Northwind (jpwhite3/northwind-SQLite3 ${COMMIT.slice(0, 7)})`,
  ];
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const values = rows
      .slice(i, i + ROWS_PER_INSERT)
      .map((row) => `(${Object.values(row).map(literal).join(", ")})`)
      .join(",\n");
    lines.push(`INSERT INTO seed_${table.name} (${table.columns.join(", ")}) VALUES\n${values};`);
  }
  writeFileSync(new URL(`${table.name}.sql`, OUT), lines.join("\n") + "\n");
  console.log(`${table.name}: ${rows.length} rows`);
}
