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

- **Contract rules** live in `src/lib/config/rules.ts` as `DEFAULT_RULES`, and an
  administrator can override any number on the sheet's Settings tab
  (`applyRuleOverrides`). Read the rules in force with `getRulesConfig()` and
  pass them down — never import `RULE_SETS` into a page or component.
- **The rules engine** (`src/lib/rules/evaluate.ts`) is pure: `(rows, today) ->
  rows + computed`. It must stay free of I/O and of `new Date()` so the tests
  can pin behaviour to a fixed date. Add a test in `evaluate.test.ts` for every
  rule change.
- **Storage** goes through `ContractRepository` (`src/lib/data/repository.ts`).
  Pages and routes call `src/lib/services/*`, never a repository directly.
- **The sheet has four tabs**: Contracts (the database), Dashboard (rewritten by
  every system check), Settings (recipients *and* rule numbers, which override
  the env vars and defaults via `src/lib/services/settings.ts`) and Run Log.
- **Anything an administrator must do should be doable in the app.** Sheet setup,
  recipients, rules and a test email are all in the UI; adding a new
  terminal-only step is a regression.
- **Dashboard counts** come from saved views in `src/lib/domain/views.ts` — one
  predicate per tile, reused by `/contracts?view=<id>` so a number and its list
  cannot drift apart.
- **Colours** come from `src/lib/ui/tones.ts` (Tailwind classes for the UI, hex
  for the emails) via the metadata in `src/lib/domain/meta.ts`. No ad-hoc colour
  classes in components.
- **Reports** are built as data (`src/lib/reports/build.ts`) and then rendered
  (`render-email.ts`), so the on-screen preview and the sent email are the same
  thing.

## Access

- Who may sign in comes from the sheet's Users tab (`listUsers`), resolved by
  `resolveSignIn`; `ADMIN_EMAILS` is the lock-out escape hatch.
- Permissions live in `src/lib/auth/roles.ts`. Pages call `requireViewer`, API
  routes call `guardApi`, and server actions check `can(...)` — never rely on
  hiding a button alone.
- Pages that show contracts use `loadVisibleSnapshot`, which scopes a Manager to
  their own team using the same Manager Email column the reports use.

## Security rules

- Anything written to the sheet or a CSV goes through `neutraliseFormula` —
  spreadsheet cells execute, so user text must never start `=`, `+`, `-` or `@`.
- Content rendered from sheet data into HTML is escaped (`escapeHtml`), and the
  report preview frame stays `sandbox=""`.
- Secrets are compared with the constant-time helpers in `lib/auth/session.ts`,
  never with `===`.
- New API routes are protected by the proxy by default; adding a path to the
  `/api/cron` exemption means it must check `authoriseCron`.

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
