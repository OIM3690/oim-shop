# oim-shop

The internal sales system of Northwind Traders, a fictional food wholesaler, built as an open-source reference product for OIM3690. A sales rep uses it to look up products, review customers and orders, and, from `v3`, enter orders for customer companies.

## Start at your level

The product grows in tagged versions on one history. Open the version that matches what you already know, then read the comparison to see what the next version adds.

| Version | What it adds | Read the code | What changed |
| --- | --- | --- | --- |
| `v1` | One HTML file that calls a public API with `fetch` | [`/tree/v1`](https://github.com/OIM3690/oim-shop/tree/v1) | |

`v2` (a React and TypeScript interface) and `v3` (its own server, a dashboard, sign-in and order entry) will be added to this table when they are released. The plan for all versions is in [`docs/prd.md`](docs/prd.md).

## Run v1

Open `v1/index.html` in a browser. It needs no install and no server: the page calls the course API at `https://oim.zhili.dev/shop` directly.

The page asks the API to do the searching, filtering and paging, so a search covers all 77 products and every page of results.

## Run v2

You need [Node.js](https://nodejs.org) 24 or later. From the repository root:

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/oim-shop/`. The app lives in `web/`: a React and TypeScript interface that reads the course API directly, with products, customers, orders and employees. Searching, filtering and paging all happen on the API, and the filters stay in the address, so you can share a link to a filtered list.

## Run the tests

```bash
npx playwright install chromium
npm run lint
npm run typecheck
npm run test:unit
npm test
```

- `npm run test:unit` runs Vitest on the v2 code: each page is rendered at an address, and [MSW](https://mswjs.io) answers its requests from data recorded from the API in `web/src/mocks/data/`.
- `npm test` runs Playwright in a real browser, at desktop and phone sizes. It opens `v1/index.html` from disk, and it builds and serves v2 with the same recorded data, so no test calls the real API.

To run one test, give part of its name: `npx playwright test -g "loading state"`, or `npx vitest run -t "filters by employee"` inside `web/`.

## Data and licenses

The data is Northwind Traders, from [jpwhite3/northwind-SQLite3](https://github.com/jpwhite3/northwind-SQLite3) and Microsoft's [sql-server-samples](https://github.com/microsoft/sql-server-samples), both under the MIT License. Their notices are in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

The code is under the MIT License, in [`LICENSE`](LICENSE). To report a security problem, see [`SECURITY.md`](SECURITY.md).
