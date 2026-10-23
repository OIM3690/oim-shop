# AGENTS.md

Instructions for coding agents working in this repository.

- Requirements are in `docs/prd.md`. Do not change scope, and do not decide anything the PRD marks **Pending**.
- The product grows in tagged versions (`v1`, `v2`, `v3`). Files of a later version never appear before its tag, and `v1/index.html` stays plain JavaScript with no build step.
- Search, filtering and paging happen on the server (`oim-api` until `v3`). Never filter the current page of results in the browser.
- Put text from the API on the page with `textContent` or a `<template>`, never with `innerHTML`.
- Run everything from the repository root: `npm install`, `npx playwright install chromium`, then `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npm test`. To run a single test: `npx vitest run -t "<part of its name>"` in `web/`, or `npx playwright test -g "<part of its name>"`. No test calls the real API: `e2e/fake-api.js` serves v1, and `web/src/mocks/` serves v2 through MSW.
- In `web/`, only `src/lib/api.ts` calls the API, and every response goes through its zod schemas.
- Everything committed is in English and is read by students.
