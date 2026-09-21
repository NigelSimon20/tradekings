<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Blue Collar Contract Tracker

Contract tracking for Trade Kings & Zimkings blue-collar and casual employees.
A Google Sheet is the database; this app applies the contract rules, shows a
dashboard and sends the weekly reports. See README.md for setup.

## Where things belong

- **Contract rules** live in `src/lib/config/rules.ts`. Change the numbers there,
  never in a component or a report.
- **The rules engine** (`src/lib/rules/evaluate.ts`) is pure: `(rows, today) ->
  rows + computed`. It must stay free of I/O and of `new Date()` so the tests
  can pin behaviour to a fixed date. Add a test in `evaluate.test.ts` for every
  rule change.
- **Storage** goes through `ContractRepository` (`src/lib/data/repository.ts`).
  Pages and routes call `src/lib/services/*`, never a repository directly.
- **The sheet has four tabs**: Contracts (the database), Dashboard (rewritten by
  every system check), Settings (report recipients, which override the env vars
  via `src/lib/services/settings.ts`) and Run Log.
- **Dashboard counts** come from saved views in `src/lib/domain/views.ts` — one
  predicate per tile, reused by `/contracts?view=<id>` so a number and its list
  cannot drift apart.
- **Colours** come from `src/lib/ui/tones.ts` (Tailwind classes for the UI, hex
  for the emails) via the metadata in `src/lib/domain/meta.ts`. No ad-hoc colour
  classes in components.
- **Reports** are built as data (`src/lib/reports/build.ts`) and then rendered
  (`render-email.ts`), so the on-screen preview and the sent email are the same
  thing.

## Conventions

- Server components by default; `"use client"` only for interaction.
- Brand blues come from the `brand-*` and `accent-*` scales in `globals.css`.
  Never reach for Tailwind's stock `blue-*`, and keep severity colours in
  `src/lib/ui/tones.ts`.
- The app carries no company logo — it serves two companies. The mark is
  `BrandWordmark` ("Trade Kings · Zimkings"); don't reintroduce an image.
- A server component may pass an *element* to a client component but never a
  component function — render icons as `icon={<Thing />}`.
- Reading browser storage belongs in `useStoredValue` (a `useSyncExternalStore`
  wrapper), not in an effect; derive state from props where possible so the
  `react-hooks` rules stay quiet.
- Files kebab-case, exports PascalCase for components and camelCase otherwise.
- A `"use server"` file may only export async functions — shared constants live
  elsewhere (see `src/lib/domain/form-state.ts`).
- Modules that touch the network or the filesystem import `server-only`.
- Before finishing: `npm run typecheck && npm run lint && npm test`.
