# The rules this app follows

These started as the Nucleus prototypes estate's conventions (`vardan-kabra/nucleus-prototypes`),
where this app was first built on 26-Sep-2026. On 30-Sep-2026 it moved to its own repository and
**no longer depends on that estate or anyone in it**. The rules are copied here so they stay true
without it. If the app later moves into Nucleus, these same rules make that easy.

## Dates

- **Shown as `DD-MMM-YYYY`** (03-Aug-2026). Never MM-DD-YYYY. Month and year alone: `MMM-YYYY`.
- **Stored as `YYYY-MM-DD` strings**, so they sort correctly.
- **Built from the string, never through a local-time `Date`.** The Asia/Calcutta time-zone history
  has shifted real dates by a whole month in Nucleus apps before. `engine/ist.ts` uses a fixed
  +05:30, and `engine/posh.ts` does date arithmetic on the parts with `Date.UTC`.

## Sign-in

- **Google sign-in, always on.** Only accounts on the school's email domains get in
  (`lib/auth/org-domains.ts`, the `SEED_ORG_DOMAINS` list, or the `AUTH_ALLOWED_DOMAINS` setting).
  Check with the school's IT before changing that list: a missing domain silently refuses real staff.
- **Signing in only lets you in.** It never lets you change anything: that needs a grant.
- **Fails closed.** Live with no Google client set, the app refuses everyone (503) rather than
  letting anyone in. On a local computer with none set, it signs you in as a pretend dev user.
- **One address per app.** Sign-in breaks if people start on one address and Google returns them
  to another. If the app ever gets a second address, the old one goes in `middleware.ts` so it
  redirects to the right one.

## Rights

- **A grant row's existence is the permission.** No role field, no hidden "viewer" level.
- `AppUserRight.unit` is one unit's code, or `null` for **every unit, now and future**.
- **Administrators** come from the `RIGHTS_ADMIN_EMAILS` setting (default: Sachin), so the first
  grant can always be made.
- **Every change checks the right against the unit it changes**, on the server, after the input is
  checked. The page hiding a button is a convenience, never the protection.

## Activity

- **Every app that records a trail lets a person read it.** `/activity`: administrators see
  everyone, everyone else sees only themselves, matched exactly (two people whose emails share a
  word must never see each other's rows).
- **The row names the real person**, never a role.
- **Sign-ins are recorded** once per person per 8 hours and shown as a 24-hour strip; the list
  itself shows decisions.
- **The trail stores counts and codes**, never free text people typed.

## Data

- **Past audited records are frozen.** When the old portal's data comes across it is copied
  exactly, never recalculated, reformatted or "improved" (JC's rule D3). The portal's export files
  carry a SHA-256 fingerprint; an import checks it before writing anything.
- **Never run anything against a production database by hand**, and never an import nobody has
  checked with a dry run first.
- **No student data in this app.** Incident reporting (Exigency) handles children's information and
  needs stronger protection than this app has. It stays out.

## Tests

- Every rule above that code enforces has a test. A bug found becomes a test before it is fixed.
- A test never picks its database from `DATABASE_URL`. Today no test uses a database at all.
