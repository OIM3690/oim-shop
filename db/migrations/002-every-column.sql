-- Every table and column of Northwind, except the two empty tables, the
-- stored queries, and the employees' PhotoPath. The columns are added to the
-- seed_* tables, which hold the source as it is, and to the app's tables,
-- which the seed loader fills from them (api/src/northwind.ts). A database
-- that was seeded before this migration gets the new data in the same step.
ALTER TABLE seed_categories ADD COLUMN picture BLOB;
ALTER TABLE seed_suppliers ADD COLUMN contact_name TEXT;
ALTER TABLE seed_suppliers ADD COLUMN contact_title TEXT;
ALTER TABLE seed_suppliers ADD COLUMN address TEXT;
ALTER TABLE seed_suppliers ADD COLUMN city TEXT;
ALTER TABLE seed_suppliers ADD COLUMN region TEXT;
ALTER TABLE seed_suppliers ADD COLUMN postal_code TEXT;
ALTER TABLE seed_suppliers ADD COLUMN country TEXT;
ALTER TABLE seed_suppliers ADD COLUMN phone TEXT;
ALTER TABLE seed_suppliers ADD COLUMN fax TEXT;
-- As the source has it, an Access hyperlink: "text#address#".
ALTER TABLE seed_suppliers ADD COLUMN home_page TEXT;
ALTER TABLE seed_shippers ADD COLUMN phone TEXT;
ALTER TABLE seed_products ADD COLUMN units_on_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seed_customers ADD COLUMN contact_title TEXT;
ALTER TABLE seed_customers ADD COLUMN address TEXT;
ALTER TABLE seed_customers ADD COLUMN region TEXT;
ALTER TABLE seed_customers ADD COLUMN postal_code TEXT;
ALTER TABLE seed_customers ADD COLUMN phone TEXT;
ALTER TABLE seed_customers ADD COLUMN fax TEXT;
ALTER TABLE seed_employees ADD COLUMN title_of_courtesy TEXT;
ALTER TABLE seed_employees ADD COLUMN birth_date TEXT;
ALTER TABLE seed_employees ADD COLUMN address TEXT;
ALTER TABLE seed_employees ADD COLUMN region TEXT;
ALTER TABLE seed_employees ADD COLUMN postal_code TEXT;
ALTER TABLE seed_employees ADD COLUMN home_phone TEXT;
ALTER TABLE seed_employees ADD COLUMN extension TEXT;
ALTER TABLE seed_employees ADD COLUMN photo BLOB;
ALTER TABLE seed_employees ADD COLUMN notes TEXT;
ALTER TABLE seed_orders ADD COLUMN ship_name TEXT;
ALTER TABLE seed_orders ADD COLUMN ship_address TEXT;
ALTER TABLE seed_orders ADD COLUMN ship_region TEXT;
ALTER TABLE seed_orders ADD COLUMN ship_postal_code TEXT;
CREATE TABLE seed_regions (region_id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE seed_territories (territory_id TEXT PRIMARY KEY, name TEXT NOT NULL, region_id INTEGER NOT NULL);
CREATE TABLE seed_employee_territories (
  employee_id INTEGER NOT NULL, territory_id TEXT NOT NULL, PRIMARY KEY (employee_id, territory_id)
) WITHOUT ROWID;

ALTER TABLE categories ADD COLUMN picture BLOB;
ALTER TABLE suppliers ADD COLUMN contact_name TEXT;
ALTER TABLE suppliers ADD COLUMN contact_title TEXT;
ALTER TABLE suppliers ADD COLUMN address TEXT;
ALTER TABLE suppliers ADD COLUMN city TEXT;
ALTER TABLE suppliers ADD COLUMN region TEXT;
ALTER TABLE suppliers ADD COLUMN postal_code TEXT;
ALTER TABLE suppliers ADD COLUMN country TEXT;
ALTER TABLE suppliers ADD COLUMN phone TEXT;
ALTER TABLE suppliers ADD COLUMN fax TEXT;
-- Only a web address (http or https); the source's other links point into
-- the Access database itself.
ALTER TABLE suppliers ADD COLUMN home_page TEXT;
ALTER TABLE shippers ADD COLUMN phone TEXT;
ALTER TABLE products ADD COLUMN units_on_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN contact_title TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN region TEXT;
ALTER TABLE customers ADD COLUMN postal_code TEXT;
ALTER TABLE customers ADD COLUMN phone TEXT;
ALTER TABLE customers ADD COLUMN fax TEXT;
-- A Northwind employee's personal details, sent only to people signed in.
-- A rep's row leaves them empty.
ALTER TABLE employees ADD COLUMN title_of_courtesy TEXT;
ALTER TABLE employees ADD COLUMN birth_date TEXT;
ALTER TABLE employees ADD COLUMN address TEXT;
ALTER TABLE employees ADD COLUMN region TEXT;
ALTER TABLE employees ADD COLUMN postal_code TEXT;
ALTER TABLE employees ADD COLUMN home_phone TEXT;
ALTER TABLE employees ADD COLUMN extension TEXT;
ALTER TABLE employees ADD COLUMN photo BLOB;
ALTER TABLE employees ADD COLUMN notes TEXT;
ALTER TABLE orders ADD COLUMN ship_name TEXT;
ALTER TABLE orders ADD COLUMN ship_address TEXT;
ALTER TABLE orders ADD COLUMN ship_region TEXT;
ALTER TABLE orders ADD COLUMN ship_postal_code TEXT;

CREATE TABLE regions (region_id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE territories (
  territory_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region_id INTEGER NOT NULL REFERENCES regions
);
CREATE TABLE employee_territories (
  employee_id INTEGER NOT NULL REFERENCES employees,
  territory_id TEXT NOT NULL REFERENCES territories,
  PRIMARY KEY (employee_id, territory_id)
) WITHOUT ROWID;
CREATE INDEX employee_territories_by_territory ON employee_territories (territory_id);
