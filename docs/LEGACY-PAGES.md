# The six unbuilt pages: what the live portal does today

Read from the live portal's own code (`School-SafetyHQ/apps-script/Code.gs` + `Index.html` +
`Upkeep.html`, as of 26-Sep-2026), not from memory or screenshots. This is the input to handover
**Item 6**: *do these pages get rebuilt in Nucleus, and when?* It describes; it does not decide.

Where each page lands comes from `PORT-PLAN.md` (the page table, A1–A5, D1–D4) and
`SSHQ-RECONCILIATION.md`. Those rulings are quoted, not re-argued.

## Shared across all six

- **One Google spreadsheet is the database.** Each page owns one or more tabs in it. The script runs
  as its owner ("Execute as: Me"), open to anyone signed in on the org domain.
- **Access is a single `Schools` cell per person** in `Authorized Users`, holding school codes plus
  page tags: `CCTV`, `MONSOON`, `TRAINING`, `EXIGENCY`, `UPKEEP`, `POSH` (and `DASHBOARD`).
  `MONSOON` means that page at every school; `MONSOON:FPA|FPV` means that page at those schools
  only. A bare page tag takes the person's own school ticks.
- **Four roles**: `viewer` < `uploader` (shown as "Auditor") < `admin` < `superadmin`. Only
  `superadmin` bypasses the ticks. Editing a page needs its tag **and** at least `uploader`.
  Deleting a whole month or year needs `admin`.
- **Schools:** FSK, FSM, FWGS, FPV, FPA, FALH. POSH adds a seventh unit, `GROUP` (Group
  Operations), which is not a school and is never hidden by school scope.
- **Academic year runs June to May** everywhere.
- **Every page has a verbatim export**: `exportFrozenCctv`, `exportFrozenMonsoon`,
  `exportFrozenTraining`, `exportFrozenPosh`, `exportFrozenUpkeep`, and `exportFrozenEverything`
  (which also covers Exigency). Each writes a JSON file to Drive with a SHA-256 over it. **D3
  (frozen history) applies to these pages too**: what they hold today migrates as it is.

---

## 1. CCTV

**What it is:** a monthly estate-wide camera audit. One row per month, not per school.

| Field | Notes |
| --- | --- |
| Month, AY, sort key | the month is the row's identity; saving a month again overwrites it |
| Total cameras, Working, Not working, % not working | % is computed on save |
| Seven checks, each C / NC / blank | cameras online · issues resolved on time · critical areas covered · 90-day recording · display as required · camera quality · no obstructions |
| % C, % NC | C ÷ (C + NC); blanks are not counted |
| NC remark, monthly audit remark, auditor | free text |
| Updated by, updated on | stamped on save |

**Actions:** save a month (tag + uploader); delete a month (admin). No per-school scope: CCTV is a
single estate-wide register.

**Where it lands (PORT-PLAN):** fits SSHQ. Cameras become `Asset` rows in a `Location`, and
working or not is a periodic Check. **Tension worth raising:** D4 keeps audit targets out of the
fixed-asset register unless they are real equipment. Cameras *are* real equipment, but today's page
never lists them individually. It holds only monthly totals, so registering 462 cameras is new data
that nobody holds yet, not a port.

## 2. Monsoon Readiness

**What it is:** a 206-point checklist in 17 sections, run once a year per school.

| Field | Notes |
| --- | --- |
| School, Year, Section, Sr | the row's identity |
| Item, Check points | copied from the master template |
| Status | `C` / `NC` / `NA` / blank |
| Responsible, Remarks | responsible comes from the template, remarks are typed |
| Updated by, updated on | |

**Actions:** "generate" copies the whole template for a school and year (refused if that pair
already exists); each item then gets a status and remark; admins can delete a school-year. Scoped
per school.

**Where it lands:** fits SSHQ natively. One `SafetyChecklist` whose Checks carry
`frequency: annually`, launched **by hand** once a year (A5). "Responsible" becomes the Task
assignee.

## 3. Training Matrix

**What it is:** a grid of 22 safety trainings (rows) by six schools (columns).

| Field | Notes |
| --- | --- |
| Order, Training, Frequency | frequency is `Annual` / `Half-yearly` / `Quarterly` / `One-time`, set per training for all schools at once (admin) |
| School, Status | `Done` / `NA` / `Pending` |
| Last done, Remarks | |

**Actions:** set one cell (tag + uploader + that school); change a training's frequency (admin).

**Where it lands:** "probably" SSHQ, **needs a ruling**. It is per-training compliance at a school,
not per person, despite the name. It may belong in HR, which nucleus also has.

## 4. Exigency (incident reporting)

**What it is:** any staff member reports an incident; it is routed by email to the right people and
chased until someone marks it resolved.

| Field | Notes |
| --- | --- |
| ID, School, Department, Critical (Yes/No) | 8 departments, from "Student Safety / Medical Emergency" to "Other" |
| Location, Date of incident, Issue, Attachments, Immediate actions | the report itself |
| Resolved, Closure date, Resolved date, Suggested changes | |
| Submitter, Created at, Last reminder date, Reminder count | |

Plus six more tabs: schools (with every old name a school has had), departments, **recipients per
school × department** (To + CC), settings, a delivery log, and **email replies**.

**Behaviour:**
- **Two doors in.** The in-app form needs the `EXIGENCY` tag. A **standalone form**
  (`?page=report`) is open to *any* signed-in account, on purpose.
- **On submit:** one email to that school × department's recipients plus the submitter, subject
  `[CRITICAL] Exigency [ID] - school - department`. Mailing can be switched off in settings.
- **Daily reminder** at a set hour to every unresolved incident, unless its closure date is in the
  future or it is still inside a grace window; at most once a day per incident.
- **Replies are pulled back in:** a timed scan of the owner's Gmail for `Exigency [ID]` threads
  stores each reply against its incident.
- **Resolve / reopen** needs tag + uploader.

**Where it lands: NOT here, and not in the audit engine.** The reconciliation found it is already
designed in nucleus as **SSHQ-13**, a separate Tier-2 module, because *incidents carry student data*
and SSHQ-7 (ruled) keeps anything student-shaped out of the inspection engine. **So it should not be
built in this app.** It would put student incident data in an app outside the governance
nucleus was designed to give it.

## 5. UpKeep (campus walk-rounds)

**What it is:** a team walks the campus with a phone and logs everything that needs fixing, with
photos; each item is assigned and tracked to done.

| Field | Notes |
| --- | --- |
| ID, Round date, People on the round, School | one round produces many items |
| Department, Floor, Venue, Task | 13 departments; floors Ground → Terrace, Outdoor |
| Photos | up to 8 per item, saved to a Drive folder |
| Owners, Assigned on, Deadline | |
| Status | `Open` → `In progress` → `Long Term` → `Completed` |
| Completed on, TAT days | stamped when marked Completed, cleared if reopened |
| Comments, Reported by, Created at, Notified on | |

**Behaviour:**
- **Phone form** (`Upkeep.html`): open to any signed-in account. It remembers the round's team on
  the device, and an item is `In progress` from the start if it has an owner, `Open` if not.
- **One grouped email per owner** listing everything assigned to them. Re-assigning clears
  "notified on", so they are told again.
- Editing any field needs tag + uploader. People are a small list of their own (name, email, role,
  active).

**Where it lands:** "partly" SSHQ, **needs design**. A finding starts as an *observation with
photos*, not a scheduled Task. That is Phase 4, alongside the phone client (D2: a PWA).

## 6. POSH / POCSO

**What it is:** annual training compliance under two Acts, as counts per unit.

| Field | Notes |
| --- | --- |
| Year, Act, Unit | Act is `POSH` or `POCSO`; seven units (six schools + Group Operations) |
| Total employees, Completed | **completed is capped at total**: trained can never exceed headcount |
| Last training, Comments | renewal falls due a year after the session; shown amber inside 60 days |
| Updated by, updated on | |

**Actions:** "generate a year" adds a blank row for every unit × both Acts and **never overwrites**
an existing one; edit a field (tag + uploader); delete a year (admin).

**Where it lands:** **already decided (A4):** a small POSH-specific table with the counts, joined
for reporting, *not* one Check per member of staff, because the page shows counts, not names. It
holds no personal data at all.

---

## What this means for building here

*Rewritten 30-Sep-2026, when this app moved to its own repository to be built without waiting for
Nucleus access.* Each page gets its own small tables here, shaped so it can later be mapped onto
Nucleus's SSHQ engine (the "Where it lands" notes above).

| Page | Build it here? | Order |
| --- | --- | --- |
| **POSH / POCSO** | **Done** (26-Sep-2026). | 1 |
| **Training Matrix** | Yes. 22 trainings × 6 schools, a status per cell. The Safety-or-HR question only matters when moving into Nucleus. | 2 |
| **CCTV** | Yes, as today: one row per month with totals and seven checks. Listing each camera is new data nobody holds yet, so not now. | 3 |
| **Monsoon Readiness** | Yes: the 206-point template, copied per school per year, C / NC / NA per item. | 4 |
| **UpKeep** | Yes, but it is the biggest: phone form, photos, owners, emails. Photo storage needs a decision first. | 5 |
| **Exigency** | **No.** It carries student data and needs stronger protection than this app has. | — |
