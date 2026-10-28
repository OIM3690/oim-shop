# Seed data

Northwind Traders, as `INSERT` statements into the `seed_*` tables. `scripts/build-seed.ts` writes these files from `dist/northwind.db` in [jpwhite3/northwind-SQLite3](https://github.com/jpwhite3/northwind-SQLite3) at commit `4f56e7f`, checked by its SHA-256, so the same command always rebuilds the same files.

- Dates are the source's dates, written as `YYYY-MM-DDTHH:MM:SS`. The app moves them forward onto `oim-api`'s shifted clock when it loads the seed, and keeps only the orders placed by then.
- Every table and column of the source is kept, except the two empty tables (`CustomerDemographics`, `CustomerCustomerDemo`), the stored queries, and the employees' `PhotoPath`, an address on a network that no longer exists. The photos and category pictures are JPEG files, written as blobs.
- Suppliers' home pages are kept as the source stores them, as Access hyperlinks (`text#address#`). The app keeps only an address that starts with `http`.
- The employees are fictional, but their birth dates, home addresses, phones, notes and photos are personal details, so the app sends them only to people who are signed in.
- The licenses of both sources are in [`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md).
