# School Safety HQ — notes for Claude

The owner is **Sachin Pyasi**, who is **new to development and has no local setup**. He works only
through Claude Code on the web. So:

- **Explain in plain, simple words.** No jargon without a one-line meaning. Short answers, tables
  over paragraphs, and say clearly what he needs to click or send.
- **Do everything that can be done from the session yourself**; only hand him what needs his own
  accounts (Google, Render, Neon, GitHub settings), click by click.
- **Update `README.md` in the SAME commit as every change**: the relevant section, the **Last
  updated** date, and a line in the change log. Dates as DD-MMM-YYYY.
- **This repo depends on nobody else.** It moved out of `vardan-kabra/nucleus-prototypes` on
  30-Sep-2026 precisely so no step waits on another person. Do not add anything that makes it
  depend on another repo, a private package, or someone else's account.
- Work on `main` directly unless Sachin asks for a branch or a PR; he is the only person here and
  every push to `main` deploys (Render). **So run `npm run typecheck && npm test && npm run build`
  before every push**, and never push red.

## What it is

The replacement for the old School Safety HQ portal (Google Apps Script, tinyurl.com/fs-safety),
built page by page. The old portal keeps running until each page is replaced. First page: POSH /
POCSO (done). The order of the rest and what each does: `docs/LEGACY-PAGES.md`.

**Exigency (incident reporting) is never built here**: it carries student data. Student data of any
kind stays out of this app.

## The rules

`docs/RULES.md`: dates, sign-in, rights, the Activity page, frozen data, tests. Read it before
building anything. Where code and that file disagree, the code is wrong.

What the tests pin for POSH (keep them true on every page that copies the pattern):

1. **The server decides who may edit, never the page.** A grant row per unit (`AppUserRight.unit`,
   null = every unit) or `RIGHTS_ADMIN_EMAILS`. The right is checked against the unit the WRITE lands
   on, after the input is parsed. `GROUP` (Group Operations) is a unit, not a school.
2. **An empty grant choice is refused**, never read as "every unit".
3. **Trained above the headcount is REFUSED, not clamped** (the old portal silently changed it).
4. **Blank is not zero.** Units with no headcount are "not started" and left out of totals, which
   say how many were left out.
5. **The status word is derived, never stored**: the old portal's `poshBand_`, rule for rule.
6. **Deleting a year needs an administrator AND the year typed back**, checked on the server.
7. **The trail records counts and codes, never free text.**
8. **Dates are `YYYY-MM-DD` strings** end to end, arithmetic through `Date.UTC`.

## Why no design system

The Nucleus estate has a shared design system, but it is a private package in someone else's repo,
and using it would make this repo depend on that access. The pages are styled by `app/globals.css`.
No sidebar (a top bar with links), so no mobile drawer is needed; if it ever grows a sidebar, it must
collapse into a drawer on phones.

## Hosting

Render (free web service, Docker, `render.yaml`) + Neon (free Postgres). Every push to `main`
redeploys. `prisma migrate deploy` runs on each start. Details and settings: `README.md` §6.

## Verify

```bash
npm run typecheck && npm test && npm run build
```

To see it: start a local Postgres, `DATABASE_URL=… npx prisma migrate deploy`, `npm run dev`, open
`localhost:4900` (dev mode signs you in as an administrator), save a unit, try trained above total
(refused, with the reason), check `/activity`. Look at it at ~390px wide too.
