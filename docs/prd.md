# oim-shop Product Requirements

Status: draft for review, 2026-10-22. Anything marked **Pending** is a proposal I have not decided yet.

## Purpose

oim-shop is the internal sales system of Northwind Traders, a fictional food wholesaler. It is an open-source reference product: you can read how it is built, run it on your own machine, and use the live copy. This is the JavaScript and TypeScript version, written for OIM3690.

The product grows in three steps. Each step is a git tag on one history, so you can start at the step that matches what you already know, and the comparison between two tags shows exactly what the next step adds.

| Tag | What it adds | The question it answers |
| --- | --- | --- |
| `v1` | One HTML file that calls a public API with `fetch` | What is the smallest version someone can use? |
| `v2` | A professional interface in React and TypeScript, still reading `oim-api` directly, with tests, CI and a live deployment | What does a component framework give you that one HTML file cannot? |
| `v3` | A server with its own database and API, a sales dashboard, sign-in with GitHub, and order entry | Why have a server at all, why keep a copy of data you could fetch, and who may change what? |

The repository holds no course material: no roster, no keys, no assignment answers, and no instructions for a particular class.

## The business and the user

Northwind sells to 93 customer companies in 21 countries. Its employees enter orders on the customers' behalf, and every historical order records the employee who entered it. The product is the tool those employees use: look up a product, review a customer's history, enter an order, and see how sales are going.

When you sign in (from `v3`), you become a new sales rep at Northwind. You report to Steven Buchanan, the Sales Manager (employee 5), and you enter orders for customer companies. Nobody buys anything for themselves, so there is no cart and no checkout.

| Role | Who | What they can do |
| --- | --- | --- |
| Visitor | Anyone, signed out | Read every page |
| Sales rep | Anyone signed in with GitHub (`v3`) | Everything a visitor can do, plus enter orders and change their own |
| Northwind employee | The nine employees in the source data | Appear in orders and reports; cannot sign in |

There is no admin role.

## Out of scope

Payments, a consumer storefront, an admin back office, email and notifications, shipment tracking, purchasing from suppliers, translations, a mobile app, and real customers.

## v1: Product lookup

`v1/index.html` is a single file with its JavaScript and CSS inline. It has no build step and no framework, and it calls `https://oim.zhili.dev/shop` directly from the browser.

- Product list with a category filter, search by name, and the API's pagination.
- Search, filtering and paging are done by the API. The page never filters the current page of results in the browser, because that would miss every product on the other pages.
- Product detail: category, supplier, quantity per unit, price, stock, and whether it is discontinued.
- A loading state, an empty state (a search with no match) and an error state (the API is unreachable), each designed on purpose.

Acceptance: the file works when opened from disk and from any static host such as GitHub Pages; you can reach every state above by hand; the file stays on `main` after later tags.

## v2: Sales records

A React interface with the product's list and detail pages. It still has no server of its own: every page calls `oim-api` from the browser, and `oim-api` does the searching, filtering and paging. The site is static and runs on GitHub Pages.

- **Products**: the `v1` features, in the new interface.
- **Customers**: list with search by company name and a country filter; detail with the customer's orders.
- **Orders**: list with filters for customer, employee, country and date range; detail with the order's lines and totals.
- **Employees**: list, the reporting hierarchy, and each employee's orders with their count.

Every list uses the API's `page` and `per_page` and shows the total count, so you can page through all results. Lists keep the order the API returns, with the newest order first. The browser never adds up orders itself, so revenue figures and the dashboard wait for `v3`, where the app holds every order line.

Acceptance: every page meets the interface standard below; a fresh clone runs on your machine in three commands with no account of any kind.

## v3: Server and order entry

The app gets its own server, database and API, and every page switches from `oim-api` to that API. The server keeps a copy of the Northwind data, so an order you enter can appear beside the historical ones on every page.

- **Own API**: the `v2` pages, now served by the app's API, with the same search, filters and paging handled by the server. Every list endpoint takes `page` and `per_page` (at most 100) and returns the total count.
- **Dashboard**: revenue by month, top products by revenue, sales by employee, and sales by country. One date range filters all of them.
- **Revenue on every page**: each customer's, product's and employee's revenue, and tables that sort on the server.
- **Low stock**: a flag on any product whose stock is below its reorder level, a field the seed has and `oim-api` does not serve.
- **Sync**: a scheduled job that pulls new orders and their lines from `oim-api`.
- `GET /api/health` reports whether the database answers and when the last sync ran.
- **Sign in with GitHub.** On first sign-in you choose a display name and get a new employee record that reports to employee 5.
- **New order**: choose a customer, add product lines (quantity and discount), choose a shipper, a required date and the freight. The server writes the order, its lines and the stock change together, or writes nothing.
- **My orders**: list your orders; edit or cancel one that has not shipped; mark one as shipped.
- An order you enter appears at once on the dashboard, in the customer's history and in your own sales.
- **Privacy page**: what is stored about you, and that entered orders are reset every night.

Acceptance: a test computes each dashboard figure independently from the seed and compares it with the API; every order rule below has a test that fails when the rule is removed; a failed write leaves no partial order; a rep cannot change another rep's order through the API, which a test checks by calling the API directly.

## Order rules

Each rule comes from a field already in the Northwind data. The server enforces every one of them; the interface also checks them, so you see the problem before you submit.

- A discontinued product cannot be ordered.
- Quantity is a whole number from 1 to the product's `units_in_stock`.
- Discount is from 0% to 25%, the range found in the historical orders.
- A product appears at most once in an order.
- The unit price comes from the product at the time of the order. The browser cannot set it.
- The required date is after the order date.
- Only the rep who entered an order can change it, and only while it has not shipped.
- Cancelling an order returns its quantities to stock; editing it adjusts stock by the difference.

## Data

### Sources and licenses

Northwind Traders, in the expanded build at [jpwhite3/northwind-SQLite3](https://github.com/jpwhite3/northwind-SQLite3) (MIT, copyright JP White), which extends Microsoft's Northwind sample in [microsoft/sql-server-samples](https://github.com/microsoft/sql-server-samples) (MIT, copyright Microsoft Corporation). The repository ships this data with both copyright notices in `THIRD-PARTY-NOTICES.md`.

### The live API

`oim-api` serves the same data at `https://oim.zhili.dev/shop` on a shifted clock. Every date is moved forward 1,341 days, so orders keep arriving until 2027-06-30, and the API lists only the orders placed by now (Boston time). Each response holds at most 100 items.

The order list carries totals and `employee_id` but no lines. Reading every order's lines one by one would take about 16,000 requests, which is why the `v3` server loads its database from a seed and syncs only what is new.

### Seed and sync (v3)

- The seed keeps the source dates unchanged. Loading it applies the shift from `/shop` (`clock_shift_days`) and keeps only the orders placed by the time of loading.
- Sync reads orders by date, because order IDs in this data do not follow date order. Each run reads the order list from 40 days before the newest stored order, fetches the lines of any order it does not have yet, and updates the shipped date of orders it already has. An order ships at most 37 days after it is placed, so the window catches every shipment. Orders are matched by order ID, so a repeated run changes nothing.
- About four new orders arrive per day, so an hourly sync is enough. A run makes a few requests, far below `oim-api`'s limit of 300 requests a minute.
- Orders entered in `v3` use IDs from 1,000,000 upward, far above the Northwind range (10248 to 26529), so a synced order can never collide with an entered one.

### Known quirks in the data

These come from the source data. The app shows them as they are and explains them on the page where they appear.

- The source has 1,337 orders dated before the hire date of the employee who took them.
- One customer company is named `IT` (customer `VALON`).
- Some orders have many lines: up to 77, one for every product.
- The source has 21 orders that never shipped, so their shipped date stays empty.

### Simplifications

- Synced orders do not reduce stock; only orders entered here do.
- Synced orders carry the shifted clock's dates; entered orders carry the real date and time.
- Every night, entered orders and stock return to their seeded state. Accounts and display names are kept.

## Technology

### Interface

`v1` is plain JavaScript. From `v2` on, the interface is TypeScript with Vite, React and TanStack Router, styled with Tailwind CSS and shadcn/ui, following the frontend stack in `CLAUDE.md`. It is a single-page app. In `v2` it is a static site; from `v3` the server delivers it from the same origin as the API, so there is no CORS setup and the session cookie is simple.

TypeScript starts at `v2` because the interface describes the shape of every API response in one place. When a field changes, every page that still uses the old field fails to build, and you find the problem before a user does. From `v3` the server and the interface share those types.

### Server and database (v3)

**Pending. Recommended: Hono on Node, with SQLite as the database, in a container on a small server.**

- Hono routes look like Express routes (`app.get('/api/products', ...)`), so what you learn here transfers to the most common Node server framework.
- A Hono handler receives a standard `Request` and returns a standard `Response`, the same objects you use with `fetch` in the browser.
- SQLite keeps the whole database in one file. Orders and their lines are two ordinary tables, the dashboard is plain `GROUP BY` queries, and the schema lives in numbered SQL migration files.
- The server types its routes, and the interface's API client reads those types, so a mismatch between the two fails the build. Input is validated with zod.
- On your machine the database is a file in the project, so you need no account to run or test the app.

Alternatives considered: React with Supabase, which keeps the stack of the course's final projects but leaves no server code to read; Next.js, the most common React full-stack framework, which hides where the browser ends and the server begins; Hono on Cloudflare Workers with D1, whose free plan limits rows read and written per day tightly enough that the schema would be shaped around the quota.

### Scheduled jobs (v3)

Sync (`npm run sync`) runs hourly and the reset (`npm run reset`) runs nightly, started by timers on the server. The app has no scheduler of its own.

### Layout

```text
oim-shop/
  v1/index.html     v1, unchanged after its tag
  web/              React interface (v2 onward)
  api/              Hono server, sync and reset (v3 onward)
  db/migrations/    numbered SQL migrations (v3 onward)
  data/seed/        Northwind seed data and both copyright notices (v3 onward)
  deploy/           container and timer files (v3 onward)
  e2e/              Playwright tests
  docs/             this PRD and decision records
```

## Interface standard

The `v2` and `v3` interface must look and behave like a professional product. Each item can be checked:

- One set of design tokens for color, spacing and type, in light and dark mode.
- Usable at phone width, with WCAG AA contrast, and fully usable from the keyboard.
- Every view that loads data has a loading, empty and error state.
- Money, thousands separators and dates have one format throughout.
- Tables page on the server, and from `v3` they also sort there; forms show errors next to the field; a completed action shows a toast; a destructive action asks first.
- I review a screenshot of every page in both modes before each tag.

## Security and privacy

- Reading is public and needs no sign-in. In `v1` and `v2` every request goes to `oim-api`, which applies its own limits. From `v3`, protection against bots comes from caching and limits: anonymous GET responses are cached at the edge for a few minutes, `per_page` is capped, unbounded queries are refused, each client address has a rate limit, and `robots.txt` asks crawlers to stay out of the API.
- A request that carries a session cookie skips the cache, and every response that depends on who is signed in is sent with `Cache-Control: private, no-store`. A rep therefore sees a new order at once; a visitor sees it when the cached copy expires.
- Sign-in is used only for writing. It goes through a GitHub OAuth App that requests no scopes. The app stores the GitHub user ID and the display name you choose. It never stores your email, and no page shows your GitHub username.
- The session cookie is `HttpOnly`, `Secure` and `SameSite=Lax`; every write checks the request's origin; writes have a rate limit per user and length limits on every text field.
- Secrets live in `.env` on your machine and in the server's environment file in production. The repository has `.env.example` only. Development and production use separate OAuth apps.
- `SECURITY.md` explains how to report a vulnerability.

## Engineering practice

- Vitest for the interface and, from `v3`, the server; `v2` tests replay recorded `oim-api` responses, and server tests run against a real SQLite file. A few Playwright tests cover the main flows: look up a product, and from `v3` read the dashboard and enter and cancel an order.
- TypeScript in strict mode, ESLint and Prettier, GitHub Actions CI on every push and pull request, and Dependabot.
- Tests come first, and each commit holds one change with a message you can learn from. Every tag is a state where all tests pass and the app runs.
- The repository carries `README.md`, `AGENTS.md`, an MIT `LICENSE`, `SECURITY.md` and `.env.example`.

## Repository and releases

- Public repository `OIM3690/oim-shop`. Forks run CI but never deploy: the deploy job runs only in this repository.
- Tags `v1`, `v2` and `v3` on one history, with no separate repositories and no long-lived branches per version. Each tag has a GitHub Release that states what it adds, why, and how to run that version.
- The README opens with a table for choosing where to start, linking each tag's tree (`/tree/v1`) and each comparison (`/compare/v1...v2`, `/compare/v2...v3`).
- A bug found in an earlier version after a later tag exists is fixed on a short branch from that tag and tagged `v1.1`, `v2.1` and so on.

## Deployment

- **Pending**: the live address. Proposed: `https://oim-shop-js.zhili.dev`.
- `v2` deploys to GitHub Pages from GitHub Actions after CI passes on `main`.
- From `v3`, GitHub Actions builds the container image and the server pulls it; nothing is built on the server. Migrations run before the new version starts. The live address moves from GitHub Pages to the server.

## Open items

- Choice of server, framework and database for `v3`.
- How the `v2` single-page app handles deep links on GitHub Pages.
- GitHub OAuth callback URLs for local development and production.
- Whether Playwright runs on the development machine.
