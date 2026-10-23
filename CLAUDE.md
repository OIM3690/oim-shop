# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

oim-shop is an open-source reference product for OIM3690: Northwind Traders' internal sales system, built in JavaScript and TypeScript as three tagged versions (`v1`, `v2`, `v3`) on one history. Requirements are in `docs/prd.md`; read it before changing scope, and ask Zhi before editing a requirement or resolving a **Pending** item.

This version is independent of the Python oim-shop for OIM7510/6301. Share no code, interface conventions or sync scripts with it, and do not review or change it.

## Public repository

Planned home `OIM3690/oim-shop`, public. Everything committed is in English and is read by students.

- No course material: no roster, tokens, assignment answers or instructions for a class.
- No operations details: server names, IPs, memory figures. Those live in the local project memory.
- Before committing any prose (`docs/`, `README.md`, release notes, comments addressed to readers), apply the teaching-prose skill (`~/teaching/ta/.claude/skills/teaching-prose/SKILL.md`). No hook scans this repo, so run the greps in its `references/checks.md` by hand.
- Creating the GitHub repository, DNS records or any cloud account needs Zhi's go-ahead first, each time.

## The version ladder

The diff between tags is teaching material. Each tag is a state where every test passes and the app runs on its own, and files of a later version never appear before its tag.

- **v1**: `v1/index.html` alone. Plain JavaScript and inline CSS, no build step, calling `https://oim.zhili.dev/shop` (oim-api) from the browser. It stays on `main` unchanged after later tags.
- **v2**: `web/`, a static React + TypeScript site on GitHub Pages that still reads oim-api directly. List and detail pages only; no revenue figures, no dashboard, no sorting, because the browser never aggregates orders.
- **v3**: `api/` (own server and SQLite database, seed, sync, reset), the dashboard and revenue figures, GitHub sign-in and order entry. Every page switches from oim-api to the app's own API, served from one origin.

Search, filtering and paging always happen on a server (oim-api in `v1`/`v2`, the app's API in `v3`), never on the current page in the browser.

Before each tag, take light and dark screenshots of every page and review them yourself; Zhi waived seeing them (2026-10-22). A fix to an earlier version goes on a short branch from its tag and is tagged `v2.1` and so on; that branch's own workflow deploys v2 to GitHub Pages.

## oim-api facts that shape the code

- Dates are shifted forward 1,341 days; only orders placed by now are listed; `per_page` is capped at 100. The order list has no lines, so `v3` loads from `data/seed/` and syncs incrementally.
- Sync by `order_date`, never by `order_id` (IDs are out of date order), re-reading 40 days to pick up shipped dates.
- `name` (part of the name, any case) on products and customers, `employee_id` on orders, and `clock_shift_days` on `/shop` are live since 2026-10-22. `/shop` allows 300 requests a minute per IP, shared with most of oim-api.
- The source has 1,337 orders that predate their employee's hire date. This is in the source data and is not a bug.

## Frontend Stack

One library per concern. Prefer mature libraries over hand-rolled code; component source lives in the repo (shadcn), not in a black-box package. Do not add a library for a concern not listed here, or a second library for a concern already covered, without asking first. Packages that `npx shadcn add` installs, and official companions of listed libraries (such as `@hookform/resolvers` or `@tanstack/router-plugin`), are allowed.

| Concern | Use | Notes |
| --- | --- | --- |
| Framework | Vite + React + TanStack Router | Use Next.js instead only when SSR or SEO is a requirement |
| Styling | Tailwind CSS | No CSS-in-JS, no second styling system |
| Components | shadcn/ui, style `nova` (`radix-nova` in `components.json`) | Add via `npx shadcn add`; edit the copied source rather than wrapping it |
| Icons | lucide-react | No other icon set; inline SVG only for brand logos lucide does not ship |
| Animation | motion | All hand-written animation; keep shadcn's built-in transitions as they are |
| Server state | @tanstack/react-query | All API data lives here, never in Zustand |
| Client state | zustand | UI-only state (sidebar, selections, preferences) |
| Forms | react-hook-form + zod | Through shadcn Field (not the legacy Form component); zod schemas double as API types |
| Tables | @tanstack/react-table | Through shadcn Data Table |
| Charts | recharts | Through shadcn Chart |
| Layout panels | react-resizable-panels | Through shadcn Resizable |
| Drag and drop | @dnd-kit/react | Pre-1.0: pin the exact version; the legacy `@dnd-kit/core` line has had no release since 2024-12 |
| Toasts | sonner | Through shadcn Sonner |

Where a row says "through shadcn", the shadcn component decides the underlying library and its major version; follow it rather than installing the library directly.

Copied from `~/.claude/templates/frontend-stack.md`, last verified 2026-10-20.

## Commands

Run from the repository root; `api/` and `web/` are npm workspaces. The machine is small, so run builds and test suites one at a time.

- `npm install`, then `npx playwright install chromium` once.
- `npm run dev`: seeds `api/shop.db` if it is missing, then starts the API (port 8787, `node --watch`) and Vite (port 5173, forwarding `/api`). Ctrl+C stops both.
- `npm run lint` (oxlint and Prettier in both packages), `npm run typecheck`, `npm run test:unit` (Vitest in web, then api), `npm run build` (web).
- `npm test`: Playwright. `v1-*` projects open `v1/index.html` from disk; `v3-*` projects build web and run `e2e/server.ts` on port 4173.
- `npm run seed` (refuses a database that has orders; `-- --force`), `npm run sync`, `npm run reset`. The api scripts load `api/.env` if it exists (`node --env-file-if-exists`); settings are in `api/src/config.ts`.
- One test: `npx vitest run -t "<part of its name>"` inside `api/` or `web/`, or `npx playwright test -g "<part of its name>" --project=v3-desktop`.
- Rebuild the seed from the pinned source: `node scripts/build-seed.ts`.

## How v3 is put together

- **The database.** `db/migrations/*.sql` run in order on `openDatabase`. `seed_*` tables hold the source data unshifted; `api/src/seed.ts` fills the app tables on oim-api's clock. `orders.lines_total`/`line_count` and `product_month_sales` are derived and must be refreshed (`api/src/totals.ts`) in the same transaction as any write to `order_lines`; the dashboard and every revenue figure read them, never the 600,000 lines.
- **SQL.** Raw parameterized SQL through `node:sqlite`, no ORM. It refuses named parameters the statement does not use, so pass them through `usedBy()` (`api/src/http.ts`). Text matching uses the registered `fold()` (Unicode lowercase); customer IDs match `upper(trim(...))` both sides, because one source ID is `"Val2 "`.
- **One description of the data.** `api/src/schemas.ts` holds every response shape and the input rules (`orderInput`, `displayName`). Routes parse their output with them; `web` imports them as `api/schemas`. Add a field there first.
- **Routes.** `api/src/app.ts` builds the Hono app; `routes/*.ts` per resource. Write routes put `requireRep` on each route, never `.use()` on a sub-app that shares a prefix with read routes. Every non-GET request must carry the site's `Origin` (`sameOriginWrites`). Rate limits and `Cache-Control` are set in `app.ts`: anonymous GETs are `public, max-age=60`, anything for a signed-in user or under `/api/me` and `/api/auth` is `private, no-store`.
- **Sign-in.** Arctic's GitHub client, no scopes; only the numeric GitHub ID is stored. Sessions store the SHA-256 of a random token.
- **Web.** `web/src/lib/api.ts` is the only place that calls the API; `lib/queries.ts` holds the react-query options, and `refetchAfterWrite` refreshes everything a write can change. Filters, sort and page live in search params validated by zod with `.catch()`; changing a filter or the sort resets `page`. Tables use TanStack Table v9 with no row features; the API pages, filters and sorts.
- **Tests.** API tests copy a template database seeded once per run (`api/test/global-setup.ts`). Web tests do the same and hand every `/api` request to the real Hono app through MSW (`web/src/test/api-server.ts`); jsdom cannot reach the migrations folder, so those copies open with `{ migrate: false }`. GitHub is played by MSW (`api/test/auth-helpers.ts`) on the server side and by Playwright's route on `/api/auth/github` in the browser.
- **Deployment.** `Containerfile` builds one image; CI's `image` job builds it for `linux/amd64`, smoke-tests it and pushes it to `ghcr.io/oim3690/oim-shop` from `main` (`:main`) and from tags (`:vN`, `:latest`). `deploy/` holds the Quadlet units and timers; the port (a `PublishPort` line added to the server's copy, since podman 4.x Quadlet ignores `.container.d`) and the memory limits (a systemd drop-in on the `.service`) are set on the server and recorded in the local project memory, never in this repo.
- **Access log and page counts.** `startServer` (`api/src/serve.ts`) logs one line per request, without the query or the client address. With `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` set, it adds the Umami tag to the page; both stay unset in development and in the repository, and the live values are in the server's environment file.
- Dark mode follows the operating system (`@custom-variant dark` is a media query in `index.css`); there is no `.dark` class.
