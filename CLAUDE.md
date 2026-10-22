# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

oim-shop is an open-source reference product for OIM3690: Northwind Traders' internal sales system, built in JavaScript and TypeScript as three tagged versions (`v1`, `v2`, `v3`) on one history. Requirements are in `docs/prd.md`; read it before changing scope, and ask Zhi rather than editing a requirement or resolving a **Pending** item yourself.

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

Before each tag, Zhi reviews screenshots of every page in light and dark mode.

## oim-api facts that shape the code

- Dates are shifted forward 1,341 days; only orders placed by now are listed; `per_page` is capped at 100. The order list has no lines, so `v3` loads from `data/seed/` and syncs incrementally.
- Sync by `order_date`, never by `order_id` (IDs are out of date order), re-reading 40 days to pick up shipped dates.
- `name` (part of the name, any case) on products and customers, `employee_id` on orders, and `clock_shift_days` on `/shop` are live since 2026-10-22. `/shop` allows 300 requests a minute per IP, shared with most of oim-api.
- 1,337 orders predate their employee's hire date. This is in the source data and is not a bug.

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

None yet: no code exists. Add the build, lint, test and single-test commands here when `web/` and `api/` are scaffolded.
