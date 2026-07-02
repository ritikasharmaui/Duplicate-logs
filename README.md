# Duplicate Logs — Full Stack App

Phase 1 of the Duplicate Logs feature (Lead Duplication Settings + Duplicate Lead Records),
rebuilt as a real local full-stack app on top of a real SQLite database, seeded from
`Leads Listing.csv` (115,251 real leads, all 207 original columns).

## Stack

- **Database:** SQLite (via Node's built-in `node:sqlite` — no native build step, no separate install)
- **Backend:** Express (port **4000**)
- **Frontend:** React + Vite (port **5173**, proxies `/api` to the backend)

Requires **Node.js 22.5+** (for `node:sqlite`). This machine has Node v24.18.0, which works.

## First-time setup

```bash
cd server && npm install && cd ..
cd client && npm install && cd ..
npm install                 # installs `concurrently` for the root dev script

npm run setup:data          # imports the CSV, computes duplicates, seeds settings (~10s)
```

`setup:data` runs three scripts in order (safe to re-run any time to reset from the CSV):
1. `import:leads` — imports all 115,251 rows / 207 columns into `leads` verbatim
2. `build:duplicates` — runs real duplicate detection (case-insensitive, "NA"/blank excluded,
   dial-code-aware mobile, group-size cap of 20 to exclude reused test/placeholder values) and
   populates `duplicate_lead_records`
3. `init:settings` — seeds the 9-source Lead Duplication Settings config + widget RA config

## Running

```bash
npm run dev
```

Opens the backend on `http://localhost:4000` and the frontend on `http://localhost:5173`.
Open the frontend URL in a browser.

## Notes on the data

- **Lead Inflow Source** is *inferred* per lead from proxy columns (Widget Name, Publisher Name,
  Lead Origin, Created By volume) since the CSV's own `Source` column is blank for 99.9% of rows.
  See `server/scripts/sourceMapping.js` for the exact heuristic — it's isolated there so the
  mapping can be adjusted without touching the detection engine.
- Duplicate matching only runs on **Registered Email**, **Registered Mobile**, and **Aadhaar Card**
  (the three unique fields with real data in this export). Real mobile/Aadhaar duplicates in this
  particular CSV turned out to be almost entirely reused test values (size 21–100+ groups), so
  after the group-size cap, the 3,368 computed duplicate records are driven almost entirely by
  email matches — that's a property of this dataset, not a bug in the engine.
- The SQLite file lives at `server/db/duplicate_logs.db`. Delete it and re-run `npm run setup:data`
  to rebuild from scratch.
