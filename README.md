# oim-shop

The internal sales system of Northwind Traders, a fictional food wholesaler, built as an open-source reference product for OIM3690. A sales rep uses it to look up products, review customers and orders, follow sales on a dashboard, and enter orders for customer companies.

## Start at your level

The product grows in tagged versions on one history. Open the version that matches what you already know, then read the comparison to see what the next version adds.

| Version | What it adds | Read the code | What changed |
| --- | --- | --- | --- |
| `v1` | One HTML file that calls a public API with `fetch` | [`/tree/v1`](https://github.com/OIM3690/oim-shop/tree/v1) | |
| `v2` | A React and TypeScript interface for products, customers, orders and employees, still reading the API directly | [`/tree/v2`](https://github.com/OIM3690/oim-shop/tree/v2) | [`v1...v2`](https://github.com/OIM3690/oim-shop/compare/v1...v2) |

`v3` (its own server and database, a dashboard, sign-in and order entry) will be added to this table when it is released. The plan for all versions is in [`docs/prd.md`](docs/prd.md).

The live copy of `v2` is at <https://oim3690.github.io/oim-shop/>.

## Run v1

Open `v1/index.html` in a browser. It needs no install and no server: the page calls the course API at `https://oim.zhili.dev/shop` directly.

## Run the app

You need [Node.js](https://nodejs.org) 24 or later. From the repository root:

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/`. The first run fills `api/shop.db` from the Northwind data in `data/seed/`, which takes a few seconds. `npm run dev` starts two programs: the API server in `api/` on port 8787, and Vite, which serves the pages in `web/` and forwards every `/api` request to the API, so the browser sees one origin.

- `api/` is the server: [Hono](https://hono.dev) on Node, with SQLite as the database (Node's built-in `node:sqlite`). The schema is plain SQL in `db/migrations/`.
- `web/` is the interface: React, TypeScript, TanStack Router and Query, Tailwind CSS and shadcn/ui. Its types come from the server's schemas in `api/src/schemas.ts`.
- `npm run sync` pulls new orders from the course API; `npm run reset` removes the orders entered in the app and puts stock back. On the live server, timers run them every hour and every night.

Signing in needs a GitHub OAuth App of your own. Copy `.env.example` to `api/.env` and fill in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, with the callback URL `http://localhost:5173/api/auth/github/callback`. Everything else works without it.

## Run the tests

```bash
npx playwright install chromium
npm run lint
npm run typecheck
npm run test:unit
npm test
```

- `npm run test:unit` runs Vitest on both halves. The server's tests use a real SQLite file seeded from `data/seed/`. The interface's tests render each page at an address, and [MSW](https://mswjs.io) hands its requests to the real API on a test database.
- `npm test` runs Playwright in a real browser at desktop and phone sizes. It opens `v1/index.html` from disk, and it builds the app and runs the real server on a seeded copy of the database, with GitHub's sign-in answered by a stand-in. No test calls the course API or GitHub.

To run one test, give part of its name: `npx playwright test -g "deep link"`, or `npx vitest run -t "order rules"` inside `api/` or `web/`.

## Data and licenses

The data is Northwind Traders, from [jpwhite3/northwind-SQLite3](https://github.com/jpwhite3/northwind-SQLite3) and Microsoft's [sql-server-samples](https://github.com/microsoft/sql-server-samples), both under the MIT License. Their notices are in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md), and [`data/seed/README.md`](data/seed/README.md) explains how the seed is built.

The code is under the MIT License, in [`LICENSE`](LICENSE). To report a security problem, see [`SECURITY.md`](SECURITY.md).
