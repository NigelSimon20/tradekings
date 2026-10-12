# Trade Kings · Zimkings — Internal Trackers

One web app, one link and one sign-in for four internal tools used by
**Trade Kings Zimbabwe (Pvt) Ltd** and **Zimkings Trading (Pvt) Ltd**.

| App | What it does |
| --- | --- |
| **Contract Tracker** | Tracks contracts for blue-collar and casual employees, applies the company's contract rules, and emails a weekly status report to HR and each manager. |
| **Billboard Tracker** | Keeps every billboard site on a map with its lease, contacts, campaigns, maintenance, photos and documents. |
| **License Tracker** | Keeps every license, permit and certificate for sites, vehicles, equipment and the company, with renewals and expiry alerts. |
| **Expat Tracker** | Keeps a full profile of every expatriate employee and their dependants — passports, permits, applications, homes, vehicles, documents and follow-ups — and emails reminders before anything expires. |

Everyone signs in with their Google account. What a person can open, and what
they can do inside it, is decided by administrators. Someone with access to more
than one app switches between them from the menu under **Trade Kings · Zimkings**;
someone with one app goes straight into it.

Each app keeps its records in its own Google Sheet, so the data stays readable
and editable by people. The app adds the rules, dashboards, maps, reminders,
exports and reports on top.

---

## Contract Tracker

- **Applies the contract rules automatically:**
  - Trade Kings blue collar — 6-month contracts, unlimited renewals.
  - Zimkings — up to 1 year per contract, a maximum of 5 contracts.
  - Casuals — weekly contracts, 6 in a 6-week period, then a 3-month break before
    they can be rehired.
- **Works out for every employee** the days remaining, the contract status
  (active, expiring within 30 or 15 days, expires today, expired, overdue…), how
  close they are to their contract limit, and when a casual can be rehired.
- **Dashboard** with every count clicking through to the list behind it, and the
  contracts that need a decision now.
- **Contracts list** with search and filters by company, department, cost centre,
  manager, contract type, status, days remaining and location.
- **Contract page** with the employee's history, editing, and *Create renewal*.
- **Import** contracts from a spreadsheet file (with a preview before anything is
  saved) and **export** the database.
- **Weekly report email** every Monday — the full picture to HR, and each manager
  only their own team. Managers can also be given read-only access to their team.
- **Rule numbers and report recipients** can be changed in the sheet without a
  developer.

## Billboard Tracker

- **Map** of every site, coloured by status, with sites needing follow-up
  highlighted; search and filter by status, city, lease and brand.
- **Dashboard** of active, inactive and under-maintenance sites, expired leases,
  and leases expiring within 30 and 90 days.
- **Billboard profile** — details, lease, landlord / council / contractor
  contacts, current and past campaigns, maintenance visits, photos and documents,
  and a history of every change.
- **Pick on map** to place a site: search for a place, drop or drag the pin, or
  use your location when standing at the site.
- **Photos and documents** filed in Google Drive by city and site.

## License Tracker

- **Dashboard and map** — active, expiring soon, expired, pending renewal,
  requiring action and upcoming renewals, with every location on a map coloured
  by its most urgent license.
- **License register** with search (license number, vehicle registration, site,
  type) and filters by location, asset type, category, license type, department
  and expiry status; export what is filtered.
- **License page** — details, issuing authority, dates, contacts, conditions,
  documents, renewal history, and *Record a renewal* with the renewed
  certificate.
- **Assets and locations** — warehouses, factories, depots, sites, trucks,
  vehicles, equipment and the company itself, each with all of its licenses.
- **Reminder windows** (90, 60, 30 and 7 days by default) that decide what counts
  as expiring soon and what needs action.

## Expat Tracker

- **Expat profile** — personal and employment details, passports, visas, work
  and residence permits, the household (spouse, children and their documents),
  accommodation and leases, vehicles and insurance, documents, follow-ups and a
  full activity history. A one-page printable summary is available for each
  expat.
- **Family / household view** showing the expat and every dependant side by side
  with their document status and expiry dates.
- **Applications and renewals** followed through *Documents Required → Ready for
  Submission → Submitted → In Progress → Approved → Issued*, showing which
  supporting documents are still outstanding. When a renewal is issued, the old
  document becomes history — nothing is overwritten.
- **Profile status** — *Complete*, *Missing documents* or *Action required*, with
  the reasons listed.
- **Dashboard** of active and inactive expats, dependants, documents and permits
  approaching expiry, leases, licences and insurance approaching expiry, expired
  items, applications in progress, incomplete profiles and outstanding
  follow-ups, with an *Action required* list.
- **Master expiry view** of every date across all expats and dependants,
  filterable by person, document type, date, status and responsible person.
- **Follow-ups** with a responsible person, due date, status and notes.
- **Reminder emails** before anything expires — the timing is set on a months
  and days wheel — sent to HR and the expat's manager, each reminder only once.
- **Offboarding** archives an expat with their departure date, permit
  cancellation, property handover, vehicle return and final notes — never
  deleted, and can be restored.
- **Excel exports** of the expat list, the expiry view and follow-ups.

---

## Across all the apps

- **One sign-in, access per app.** Administrators decide, from inside the app,
  who may sign in and what role they have in each app. Roles and what each role
  may do are set with tickboxes in a spreadsheet, so new roles need no developer.
  Removing someone's access takes effect within about 30 seconds.
- **Sensitive information is protected.** In the Expat Tracker, people without
  permission never see passport and permit numbers, dates of birth, personal
  contacts, addresses, rent or documents — not on screen and not in exports.
- **History is kept.** Every change records who made it and when. Records are
  archived rather than deleted, and replaced documents are kept as history.
- **Documents and photos** are stored in Google Drive, in tidy folders per record,
  and previewed inside the app without being shared publicly. Each app can use a
  company Drive account or a folder someone has shared with it.
- **A number and its list always agree** — every dashboard figure opens exactly
  the records it counts, and every list can be filtered and exported.
- **Works on a phone** as well as a computer.

Built with Next.js, React, TypeScript and Tailwind CSS, on Google Sheets and
Google Drive, with maps from OpenStreetMap.
