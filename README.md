# Blue Collar Contract Tracker — Trade Kings & Zimkings

Automated contract tracking for blue-collar and casual employees across
**Trade Kings Zimbabwe (Pvt) Ltd** and **Zimkings Trading (Pvt) Ltd**.

A Google Sheet stays the central database. This app reads it, applies the
contract rules, shows a dashboard, and emails a weekly contract status report —
the complete database to HR and a filtered list to each manager.

```
Google Sheet  ──read──▶  rules engine  ──▶  dashboard (Next.js)
   ▲                                    └─▶  weekly emails (HR + managers)
   └──────── calculated columns written back on every system check
```

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Google credentials the app runs on a generated sample database
(`data/contracts.local.json`, 58 contracts covering every status, contract limit
and rehire case) so the whole system can be explored before the sheet is wired
up. Emails are written to `.outbox/` instead of being sent.

```bash
npm test             # rules engine + report tests
npm run typecheck
npm run lint
npm run build
```

## Connecting the Google Sheet

1. **Create a service account** in Google Cloud and enable the *Google Sheets
   API*. Download the JSON key.
2. **Share the spreadsheet** with the service account email address
   (`…@….iam.gserviceaccount.com`) as an **Editor**.
3. **Fill in `.env.local`** (copy `.env.example`):

   ```ini
   GOOGLE_SHEET_ID="1AbC…"                     # from the sheet URL
   GOOGLE_SERVICE_ACCOUNT_EMAIL="…@….iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
   ```

4. **Prepare the tabs**:

   ```bash
   npm run sheet:setup            # headers, dropdowns, date formats, colour coding
   npm run sheet:setup -- --seed  # …and load the sample rows
   ```

   The script is safe to re-run: it only ever adds missing columns.

The spreadsheet ends up with four tabs:

| Tab | What it holds |
| --- | --- |
| **Contracts** | The database. HR fills in the left-hand columns; the system writes the calculated ones. |
| **Dashboard** | The summary view, rebuilt on every system check, with links back into the tracker. |
| **Settings** | Report recipients, changeable by an administrator without a redeploy. |
| **Run Log** | Every system check and report send. |

Columns are matched **by header text**, not by position, so HR can reorder or
insert columns in the sheet without breaking anything. The full list is on the
**Rules & settings** page in the app.

| Filled in by HR | Calculated by the system (overwritten on each check) |
| --- | --- |
| Contract ID, Employee ID, Employee Name, Employee Email, Company, Worker Type, Department, Cost Centre, Job Title, Contract Type, Contract Start Date, Contract End Date, Contract Number, Renewal Status, Responsible HR Person/Email, Direct Manager, Manager Email, Location / Site, Notes, Last Updated | Contract Count, Days Remaining, Contract Status, Contract Limit Status, Rehire Eligibility Date, Rehire Status, Flags |

## Email: tkzim addresses or Gmail?

**Keep the tkzim addresses — no new Gmail accounts are needed.** The two pieces
are independent:

* **The spreadsheet** lives in whichever Google account owns it. The app signs
  in as a *service account*, not as a person, so nobody has to share a password
  and no mailbox is involved.
* **The email** goes out over plain SMTP. Any provider works:

  | Mail provider for tkzim.co.zw | `SMTP_HOST` | `SMTP_PORT` |
  | --- | --- | --- |
  | Google Workspace | `smtp.gmail.com` | 587 (app password on the sending account) |
  | Microsoft 365 | `smtp.office365.com` | 587 |
  | Own/hosted mail server | e.g. `mail.tkzim.co.zw` | 587 or 465 |

Recommended: one dedicated mailbox, e.g. `contracts@tkzim.co.zw`, used as
`MAIL_FROM` and `SMTP_USER`, so replies from managers land somewhere sensible.

```ini
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="contracts@tkzim.co.zw"
SMTP_PASSWORD="…"               # app password, not the account password
MAIL_FROM="Contract Tracker <contracts@tkzim.co.zw>"
HR_REPORT_EMAIL="hr@tkzim.co.zw"
```

Manager addresses are **not** configured here — they come from the *Manager
Email* column in the sheet, so HR controls who receives what.

The HR recipient, the CC list and whether manager reports go out can also be set
on the sheet's **Settings** tab, which takes precedence over the environment
variables. That is how the system administrator changes recipients without a
redeploy; anything left blank there falls back to the values above.

## Scheduling

`vercel.json` registers two scheduled runs:

| Job | Schedule (UTC) | What it does |
| --- | --- | --- |
| `/api/cron/weekly-report` | Mondays 06:00 (08:00 Harare) | System check, then the HR and manager emails |
| `/api/cron/system-check` | Daily 03:00 | Refreshes every calculated column in the sheet |

Set `CRON_SECRET` in the environment — Vercel then sends it automatically, and
the endpoints refuse unauthenticated calls in production. Any other scheduler
works too:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/weekly-report
```

Both runs can also be triggered by hand from the dashboard
(**Run system check** / **Run weekly report**) and from the Reports page.

Other endpoints: `GET /api/export` (whole database as CSV, `?history=1` for
superseded rows), `GET /api/import` (blank template) and `POST /api/import`
(`mode=preview` to validate, `mode=commit` to write).

## Access

Set `APP_PASSWORD` (and ideally `AUTH_SECRET`) and the whole UI moves behind a
sign-in page — the database holds employee personal information. Scheduled runs
bypass it using `CRON_SECRET`. With no `APP_PASSWORD` the app is open, which is
fine locally and not fine on the internet.

## The rules, and where they live

Everything the specification asks for is expressed in
[`src/lib/config/rules.ts`](src/lib/config/rules.ts) and applied by
[`src/lib/rules/evaluate.ts`](src/lib/rules/evaluate.ts). Change a number in the
config and the dashboard, the sheet and the emails all follow.

| Rule | Implementation |
| --- | --- |
| Trade Kings blue collar: 6 month contracts, unlimited renewals | `RULE_SETS.TK_BLUE_COLLAR` |
| Zimkings: 1 year maximum, 5 contracts maximum | `RULE_SETS.ZK_BLUE_COLLAR` (contract 4 = approaching, 5 = reached, longer than a year = flagged) |
| Casuals: weekly contracts, 6 in a 6-week period, 3 month break | `RULE_SETS.CASUAL` — contracts are counted in *cycles*; a gap of 3 months starts a new count |
| 30 days / 15 days / expired / overdue | `ALERT_DAYS` and `OVERDUE_AFTER_DAYS`; a contract becomes *Overdue* 7 days after expiry if nobody has updated it |
| Rehire eligibility date | End of the sixth casual contract + 3 months |
| Stays on the report until updated | `needsAction` — true until the renewal status is decided **or** a follow-on contract row is captured |
| Summary view inside the Google Sheet | The **Dashboard** tab, rewritten by every system check from the same counts the app shows |
| Colour coding | One palette in `src/lib/ui/tones.ts`, used by the UI, the sheet and the emails |

Statuses: `Overdue`, `Expired`, `Expires Today`, `Expiring ≤ 15 Days`,
`Expiring ≤ 30 Days`, `Active`, `Not Started`, `Renewed`, `Closed`,
`Check Dates`.

Flags: Zimkings approaching/at the 5-contract limit, contracts longer than a
year, casuals approaching/at the 6-contract limit, casuals in the waiting
period, casuals eligible for rehire, rehires inside the waiting period, renewals
marked but not captured, missing employee ID or manager email, unusable dates.

## Look and feel

The tracker serves both companies, so it carries neither company's logo: the
mark is typographic — **Trade Kings · Zimkings**, set in Raleway with the
separator in the accent blue ([`brand-wordmark.tsx`](src/components/layout/brand-wordmark.tsx)).
The two blues (`#015290` and `#1691d0`, expanded into full tonal ramps in
[`globals.css`](src/app/globals.css)) and the neutral document glyph used as the
browser icon carry the identity instead. Severity colours stay separate from the brand palette so
"overdue" never reads as "brand blue"; they live in
[`tones.ts`](src/lib/ui/tones.ts) and are shared by the UI, the sheet's
conditional formatting and the emails.

## Project structure

```
src/
  app/
    (app)/                 signed-in pages: dashboard, contracts, reports, settings
    api/                   system check, report run, import, cron endpoints, CSV export
    login/                 password gate
  components/
    ui/                    Button, Card, Badge, Table, Field, Modal, StatCard… (no UI library)
    layout/                sidebar, top bar, alerts bell, mobile drawer
    contracts/             table, filters, form, import dialog, status badges
    dashboard/ reports/    summary band, dashboard tiles, run buttons, run log
  lib/
    config/                rules.ts (contract rules), env.ts (all environment variables)
    rules/                 evaluate.ts — the rules engine, pure and unit tested
    data/                  repository interface, Google Sheets + local JSON, csv-import.ts
    reports/               build.ts (report data), render-email.ts (HTML), csv.ts, run.ts
    domain/                types, status metadata, saved views, filters, form schema
    email/                 SMTP transport with an outbox fallback
    services/              what pages and routes call: loadSnapshot, alerts, import, system check
scripts/setup-sheet.ts     prepares the Google Sheet
```

Three ideas keep the code debuggable:

1. **The rules engine is pure.** `evaluateContracts(rows, { today })` takes data
   and a date and returns every calculated field. No network, no clock, no
   surprises — which is why the tests can pin down each rule exactly.
2. **Storage sits behind one interface.** `ContractRepository` has two
   implementations (Google Sheet, local JSON). Nothing above it knows which is
   in use.
3. **A count and a list can never disagree.** Dashboard tiles are *saved views*
   (`src/lib/domain/views.ts`): one named predicate per tile, used both to count
   and to filter `/contracts?view=…`.

## Day-to-day use

* **Dashboard** — a summary band, every count from the specification (each one
  clicking through to the matching list), and the contracts needing attention
  now.
* **Alerts** — the bell in the top bar counts contracts waiting for a decision
  plus rows that need fixing in the sheet, grouped by urgency. "Mark seen" is
  remembered per browser, so the red dot only comes back when the alerts change.
* **Contracts** — the full database with filters for company, department, cost
  centre, manager, contract type, employment type, status, days remaining,
  flags and location. Filters live in the URL, so a view can be bookmarked or
  sent to a colleague.
* **Import** — the table toolbar takes a CSV (drag and drop, or a file picker).
  Columns are matched by heading, dates may be `2026-01-31` or `31/01/2026`, and
  nothing is written until the preview has been approved: new rows, rows already
  captured, and rows that cannot be read are counted and listed first. An export
  from this system imports back cleanly, and a blank template is one click away.
* **Contract page** — everything the system calculated, the employee's contract
  history, an edit form, and **Create renewal**, which carries the employee
  details over and dates the new contract from the day after the old one ends.
* **Reports** — the exact email each recipient will receive, with the ability to
  send one report or run the full weekly cycle.
* **Rules & settings** — the rules in force, the sheet layout, the effective
  report recipients (and whether each came from the sheet or the environment),
  and the state of the Google and email connections.
* **While capturing** — the end date follows the rules for the employee, dates
  that break a rule are called out before saving (a Zimkings contract running
  past a year, a casual contract that is not a week), and starting a renewal for
  someone at their contract limit says so up front.

## Deployment

Any Node host works; Vercel is the shortest path because `vercel.json` already
describes the schedules.

1. Push the repository and import it.
2. Add the environment variables from `.env.example`. Paste the private key with
   real newlines or as `\n` — both are handled.
3. Deploy, then open **Rules & settings** to confirm the sheet is connected, and
   **Reports** to check the first preview.

`data/contracts.local.json` and `.outbox/` are development conveniences; on a
read-only host, configure Google and SMTP so neither is used.
