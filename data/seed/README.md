# Seed data

Northwind Traders, as `INSERT` statements into the `seed_*` tables. `scripts/build-seed.ts` writes these files from `dist/northwind.db` in [jpwhite3/northwind-SQLite3](https://github.com/jpwhite3/northwind-SQLite3) at commit `4f56e7f`, checked by its SHA-256, so the same command always rebuilds the same files.

- Dates are the source's dates, written as `YYYY-MM-DDTHH:MM:SS`. The app moves them forward onto `oim-api`'s shifted clock when it loads the seed, and keeps only the orders placed by then.
- Employees keep the fields `oim-api` serves: name, title, manager, hire date, city and country.
- The licenses of both sources are in [`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md).
