-- The seed_* tables hold the Northwind data as the source has it. The app's
-- tables are filled from them by the seed loader (api/src/seed.ts), which
-- moves every date onto oim-api's shifted clock. The nightly reset reads
-- seed_products to put stock back.
CREATE TABLE seed_categories (category_id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL);
CREATE TABLE seed_suppliers (supplier_id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE seed_shippers (shipper_id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE seed_products (
  product_id INTEGER PRIMARY KEY, name TEXT NOT NULL, supplier_id INTEGER NOT NULL, category_id INTEGER NOT NULL,
  quantity_per_unit TEXT NOT NULL, unit_price REAL NOT NULL, units_in_stock INTEGER NOT NULL,
  reorder_level INTEGER NOT NULL, discontinued INTEGER NOT NULL
);
CREATE TABLE seed_customers (
  customer_id TEXT PRIMARY KEY, company_name TEXT NOT NULL, contact_name TEXT NOT NULL, city TEXT, country TEXT
);
CREATE TABLE seed_employees (
  employee_id INTEGER PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, title TEXT NOT NULL,
  reports_to INTEGER, hire_date TEXT NOT NULL, city TEXT NOT NULL, country TEXT NOT NULL
);
CREATE TABLE seed_orders (
  order_id INTEGER PRIMARY KEY, customer_id TEXT NOT NULL, employee_id INTEGER NOT NULL, order_date TEXT NOT NULL,
  required_date TEXT NOT NULL, shipped_date TEXT, shipper_id INTEGER NOT NULL, freight REAL NOT NULL,
  ship_city TEXT NOT NULL, ship_country TEXT NOT NULL
);
CREATE TABLE seed_order_lines (
  order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, unit_price REAL NOT NULL, quantity INTEGER NOT NULL,
  discount REAL NOT NULL, PRIMARY KEY (order_id, product_id)
) WITHOUT ROWID;

CREATE TABLE categories (category_id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL);
CREATE TABLE suppliers (supplier_id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE shippers (shipper_id INTEGER PRIMARY KEY, name TEXT NOT NULL);

CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers,
  category_id INTEGER NOT NULL REFERENCES categories,
  quantity_per_unit TEXT NOT NULL,
  unit_price REAL NOT NULL,
  units_in_stock INTEGER NOT NULL CHECK (units_in_stock >= 0),
  reorder_level INTEGER NOT NULL,
  discontinued INTEGER NOT NULL CHECK (discontinued IN (0, 1))
);

CREATE TABLE customers (
  customer_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  city TEXT,
  country TEXT
);

-- A signed-in sales rep. Only the GitHub user ID and the name the rep chose
-- are stored: no email, no GitHub username.
CREATE TABLE users (
  user_id INTEGER PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- The nine Northwind employees, plus one row per signed-in rep (user_id set).
CREATE TABLE employees (
  employee_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT NOT NULL,
  reports_to INTEGER REFERENCES employees,
  hire_date TEXT NOT NULL,
  city TEXT,
  country TEXT,
  user_id INTEGER UNIQUE REFERENCES users ON DELETE CASCADE
);

-- lines_total and line_count are kept with each order, so lists can show and
-- sort by them without adding up 600,000 lines. entered_by_user is set for
-- orders entered in the app, and those are what the nightly reset removes.
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers,
  employee_id INTEGER NOT NULL REFERENCES employees,
  order_date TEXT NOT NULL,
  required_date TEXT NOT NULL,
  shipped_date TEXT,
  shipper_id INTEGER NOT NULL REFERENCES shippers,
  freight REAL NOT NULL,
  ship_city TEXT,
  ship_country TEXT,
  lines_total REAL NOT NULL DEFAULT 0,
  line_count INTEGER NOT NULL DEFAULT 0,
  entered_by_user INTEGER REFERENCES users
);
CREATE INDEX orders_by_date ON orders (order_date);
CREATE INDEX orders_by_customer ON orders (customer_id, order_date);
CREATE INDEX orders_by_employee ON orders (employee_id, order_date);
CREATE INDEX orders_by_country ON orders (ship_country, order_date);
CREATE INDEX orders_entered ON orders (entered_by_user) WHERE entered_by_user IS NOT NULL;

CREATE TABLE order_lines (
  order_id INTEGER NOT NULL REFERENCES orders ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  discount REAL NOT NULL CHECK (discount BETWEEN 0 AND 0.25),
  PRIMARY KEY (order_id, product_id)
) WITHOUT ROWID;
CREATE INDEX order_lines_by_product ON order_lines (product_id);

-- Revenue per product per month, kept up to date with every change to
-- order_lines, so the dashboard reads about 10,000 rows instead of 600,000.
CREATE TABLE product_month_sales (
  product_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  revenue REAL NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (product_id, month)
) WITHOUT ROWID;

-- Small facts the app remembers between runs, such as when sync last ran.
CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
