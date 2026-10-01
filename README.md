# School Safety HQ

The new School Safety HQ for Fountainhead Schools: a web app that replaces the old Google Apps
Script portal ([tinyurl.com/fs-safety](https://tinyurl.com/fs-safety)) **one page at a time**. The
old portal keeps working until every page is replaced.

| | |
| --- | --- |
| **Owner** | Sachin Pyasi |
| **Status** | First page (POSH / POCSO) built and tested. **Not online yet** (see §6). No real data yet. |
| **Depends on** | Nobody. Your own GitHub, Render, Neon and Google accounts only. |
| **Last updated** | 01-Oct-2026 |

---

## 1. What it does today

| Page | Who can use it | What it does |
| --- | --- | --- |
| **POSH / POCSO** | Anyone signed in can **see** it. Only people given rights can **change** a unit. | All 7 units (FSK, FWGS, FSM, FALH, FP Vesu, FP Adajan, Group Operations) for POSH or POCSO, in one academic year (June to May). Each shows total employees, how many are trained, the last training date, when renewal is due, and a status. Totals across all units at the top. **Download CSV** button. |
| **Who can edit** | Anyone can see the list. Only administrators can change it. | Give a person edit rights for one unit or every unit, or take them away. Search box. |
| **Activity** | Administrators see everyone; everyone else sees only themselves. | Who signed in, and every change made. |

While a page loads you see three bouncing dots (blue, red, yellow) and "Loading…". On a device set to
reduce motion they fade instead of bouncing.

### The status each unit shows

Worked out fresh from the numbers every time, using the old portal's own rules:

| Status | When |
| --- | --- |
| **not started** | no headcount entered yet |
| **overdue** | more than a year since the last training |
| **pending & due soon** | people still to train, and renewal due within 60 days |
| **N pending** | people still to train |
| **renewal near** | everyone trained, renewal due within 60 days |
| **complete** | everyone trained, renewal not near |

### Where it differs from the old portal, on purpose

- **"Trained" can never be more than "total employees".** The old portal quietly changed the number
  you typed; this one refuses it and says why.
- **No "Generate year" button.** Every unit is always shown; you fill one in and save.
- **Edit rights are per unit**, given by an administrator. Signing in alone lets you look, not change.
- **Deleting a whole year** is administrator-only, and you must type the year to confirm.

## 2. What is next

| Order | Page | Status |
| --- | --- | --- |
| 1 | POSH / POCSO | ✅ built |
| 2 | Training Matrix | next |
| 3 | CCTV | planned |
| 4 | Monsoon Readiness | planned |
| 5 | UpKeep | planned (biggest: phone form with photos) |
| — | Exigency | **never here**: it holds student data |

What each old page does today: [`docs/LEGACY-PAGES.md`](docs/LEGACY-PAGES.md).

## 3. How work gets done

You don't write code. In a Claude Code session on this repo:

1. **You say what you want** ("build the Training Matrix page", "make the table bigger on phones").
2. **Claude builds and tests it**, sends you screenshots, and saves it here (on `main`).
3. **Render puts it online by itself**, a few minutes later.

The rules every change follows (dates, sign-in, rights, the Activity page, data) are in
[`docs/RULES.md`](docs/RULES.md).

## 4. Standing rules

- **No student data**, ever.
- **Past records are frozen**: data brought over from the old portal is copied exactly, never
  recalculated.
- **Settings and passwords never go in this repo.** They go in Render's settings (§6).
- **This README is updated with every change.**

---

## 5. Running it on a computer (optional)

Not needed for you. For anyone who wants it: Node 22 and Docker, then

```bash
npm install
npm run db:up        # local database on port 5454
npm run db:deploy    # creates the tables
npm run dev          # http://localhost:4900, signed in as a pretend admin
npm test             # 81 tests, no database needed
```

## 6. Putting it online (free)

**Not done yet.** Three free accounts, all in your name. Claude will walk you through each one,
click by click.

| Step | Service | What for | Result you send to Claude |
| --- | --- | --- | --- |
| 1 | **Neon** (neon.tech) | the database | its connection string (keep it private) |
| 2 | **Render** (render.com) | runs the app, updates itself on every change | the app's address, e.g. `https://school-safety-xxxx.onrender.com` |
| 3 | **Google Cloud** (console.cloud.google.com) | the "Sign in with Google" button | a client ID and a client secret |

The settings Render needs (you paste them into Render, never into this repo):

| Setting | What it is |
| --- | --- |
| `DATABASE_URL` | from Neon, step 1 |
| `AUTH_URL` | the app's address from Render, step 2 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | from Google Cloud, step 3. **Without them the live app refuses everyone**, on purpose. |
| `AUTH_SECRET` | Render makes this one itself |
| `RIGHTS_ADMIN_EMAILS` | administrators, comma-separated. Already set to you. |

Good to know about free Render: after about 15 minutes with no visitors the app sleeps, and the next
visit takes about a minute. About $7 a month removes that, whenever you want.

## 7. Bringing the old portal's POSH numbers across

Not done yet. Two ways:

- **Best:** run `exportFrozenPosh` in the old portal's Apps Script (you requested access from JC on
  29-Sep-2026). It makes an exact copy with a fingerprint.
- **Quick:** the old portal's POSH page has a **⬇ CSV** button, one file per year and Act. Good for
  testing now; the exact copy above should replace it before real use.

---

## 8. How the code is organised

| Folder / file | What is in it |
| --- | --- |
| `app/(app)/posh/` | the POSH / POCSO page, save and delete, CSV download |
| `app/(app)/rights/` | the Who can edit page |
| `app/(app)/activity/` | the Activity page |
| `app/_Loader.tsx`, `app/loading.tsx`, `app/(app)/loading.tsx` | the loading dots |
| `app/login/`, `app/logout/` | sign-in and sign-out |
| `engine/posh.ts` | **the POSH rules**: statuses, due dates, totals, what counts as a valid edit, CSV |
| `engine/rights.ts` | who may edit which unit |
| `lib/posh.ts`, `lib/rights.ts` | saving and reading those in the database |
| `lib/auth/` | Google sign-in and the allowed school email domains |
| `prisma/schema.prisma` | the database tables: `PoshRecord`, `AppUser`, `AppUserRight`, `AuditEvent` |
| `engine/*.test.ts`, `tests/` | the automated tests (run by GitHub on every change: `.github/workflows/ci.yml`) |
| `render.yaml`, `Dockerfile` | how Render runs the app |
| `docs/` | the rules, and what the old portal's pages do |

## 9. Change log

| Date | Change |
| --- | --- |
| 26-Sep-2026 | Built in `vardan-kabra/nucleus-prototypes/school-safety/`: the six old pages written up, then the POSH / POCSO page with sign-in, per-unit edit rights, Activity and CSV. |
| 30-Sep-2026 | **Moved to this repo, with every link to other people's repos and accounts removed**, so nothing waits on anyone. Administrator default is now Sachin only. Added Render set-up (`render.yaml`), GitHub tests (`ci.yml`) and `docs/RULES.md`. Next-page order set. |
| 01-Oct-2026 | Loading dots (blue, red, yellow, with "Loading…") while a page loads; they fade instead of bounce for people who turn motion off. |
