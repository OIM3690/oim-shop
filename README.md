# oim-shop

The internal sales system of Northwind Traders, a fictional food wholesaler, built as an open-source reference product for OIM3690. A sales rep uses it to look up products, review customers and orders, and, from `v3`, enter orders for customer companies.

## Start at your level

The product grows in tagged versions on one history. Open the version that matches what you already know, then read the comparison to see what the next version adds.

| Version | What it adds | Read the code | What changed |
| --- | --- | --- | --- |
| `v1` | One HTML file that calls a public API with `fetch` | [`/tree/v1`](https://github.com/OIM3690/oim-shop/tree/v1) | |

`v2` (a React and TypeScript interface) and `v3` (its own server, a dashboard, sign-in and order entry) will be added to this table when they are released. The plan for all three is in [`docs/prd.md`](docs/prd.md).

## Run v1

Open `v1/index.html` in a browser. It needs no install and no server: the page calls the course API at `https://oim.zhili.dev/shop` directly.

The page asks the API to do the searching, filtering and paging, so a search covers all 77 products and every page of results.

## Run the tests

You need [Node.js](https://nodejs.org) 24 or later.

```bash
npm install
npx playwright install chromium
npm test
```

The tests open `v1/index.html` in a real browser, at desktop and phone sizes, and answer its requests from recorded data in `e2e/fixtures/`, so they never call the real API. To run one test, give part of its name:

```bash
npx playwright test -g "loading state"
```

## Data and licenses

The data is Northwind Traders, from [jpwhite3/northwind-SQLite3](https://github.com/jpwhite3/northwind-SQLite3) and Microsoft's [sql-server-samples](https://github.com/microsoft/sql-server-samples), both under the MIT License. Their notices are in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

The code is under the MIT License, in [`LICENSE`](LICENSE). To report a security problem, see [`SECURITY.md`](SECURITY.md).
