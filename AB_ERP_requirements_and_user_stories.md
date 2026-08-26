# AB Marketing ERP — functional requirements and user stories

Scope: the initial version as agreed in the meeting of 19 August — promoter, leader, recruitment and
customer portal, plus the cross-cutting modules those four depend on. Gamification deferred.

The ERP is a standalone platform. It does not share a frontend, a session or a navigation shell with
the existing maps, HR, QC or learning apps. It reads their data; it does not embed their UI.

**Demo markers**

- `[DEMO]` — needed for the frontend demonstration; must look and behave correctly
- `[DATA]` — needs real data to be meaningful; can run on fixtures for the demo
- `[LATER]` — not required for the demo, listed so the screen isn't designed into a corner

---

## Module 0 — Shell, identity and access

Everything else renders inside this. Build it first.

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-S-01 | The user logs in with email and password against the ERP's own login, separate from the maps, HR and QC logins | `[DEMO]` |
| FR-S-02 | The system requires a second factor where the user's access policy demands it; mandatory for customers and administrators | `[DEMO]` |
| FR-S-03 | The navigation is returned by the API as a list of permitted items, not hardcoded per role in the frontend | `[DEMO]` |
| FR-S-04 | A user's effective permissions are the role default set, plus individually granted items, minus individually revoked items | `[DATA]` |
| FR-S-05 | Any view the user lacks permission for returns a clear "no access" state, never a blank page or a partial render | `[DEMO]` |
| FR-S-06 | Every data view displays period, data source and last-updated timestamp in the page header | `[DEMO]` |
| FR-S-07 | The user can switch interface language between Norwegian and English | `[LATER]` |
| FR-S-08 | Session expiry returns the user to login without losing the current filter state | `[LATER]` |
| FR-S-09 | The platform is usable on mobile and desktop; the promoter portal is designed mobile-first | `[DEMO]` |

### User stories

**S-1.** As a promoter, I want to log in to one platform and see everything about my work, so that I don't
open four systems to answer one question.
*Accepted when:* a single login lands on the promoter front page, and no card requires a second login.

**S-2.** As a system administrator, I want to grant one specific user access to one specific view without
changing their role, so that exceptions don't force me to invent new roles.
*Accepted when:* I can search a user, see which permissions come from their role and which were set
individually, add or remove one, record a reason, and the change appears in the audit log.

**S-3.** As a security-conscious manager, I want a user who loses access to lose it immediately, so that a
departure isn't a data risk.
*Accepted when:* revoking access ends active sessions and the next request returns the no-access state.

---

## Module 1 — Promoter portal

Six nav items in v1: Forside, Resultater, Ukeplan, Mål, Kurs, Nyheter.

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-P-01 | The front page shows the weekly plan, own KPIs, goals, courses and news on one screen | `[DEMO]` |
| FR-P-02 | Every card displays the user it applies to, the period, the data source and when it was last updated | `[DEMO]` |
| FR-P-03 | The promoter sees only their own results, never another promoter's | `[DEMO]` |
| FR-P-04 | Own KPIs show doors knocked, active donors and yes percentage, with a day / week / month toggle | `[DEMO]` |
| FR-P-05 | Figures derived from approved data are labelled as such, so a lower count than the promoter expects is explained on screen | `[DEMO]` |
| FR-P-06 | The weekly plan shows doors and number of yes per day, with the current day highlighted | `[DEMO]` |
| FR-P-07 | The goal card shows own goal, period, current value and expected progression, with a behind / on track / ahead state | `[DEMO]` |
| FR-P-08 | The courses card shows mandatory courses, deadline and status, and links out to the existing learning platform | `[DATA]` |
| FR-P-09 | Courses approaching their deadline are prioritised above completed ones | `[DEMO]` |
| FR-P-10 | The news card shows published items scoped to the promoter's department, campaign or everyone | `[DATA]` |
| FR-P-11 | When a figure changes because of a quality correction, the affected card shows a short explanation and the date | `[DEMO]` |
| FR-P-12 | Leaderboards, coins, duels and achievements do not appear in the navigation in v1 | `[DEMO]` |

### User stories

**P-1.** As a promoter, I want to see my week at a glance when I open the app in the morning, so that I know
what today looks like without asking my leader.
*Accepted when:* the front page loads on a phone, shows the current week with today marked, and the
figures match what the maps app shows for the same period.

**P-2.** As a promoter, I want to know how far I am from my monthly goal, so that I can adjust my effort
before the month ends.
*Accepted when:* the goal card shows current value against target, days remaining, and whether I'm on
pace.

**P-3.** As a promoter, I want to understand why my count is lower than the doors I remember knocking, so
that I don't think the system is broken.
*Accepted when:* the KPI card states that only approved sales are counted, and the last correction that
affected me is visible with its date.

**P-4.** As a promoter, I want to see which mandatory courses I still owe and when they're due, so that I
don't lose access to a campaign over a missed deadline.
*Accepted when:* incomplete and expiring courses appear first, each with a deadline, and tapping one
opens the correct course in the learning platform.

**P-5.** As a promoter, I want to read team and campaign news in the same place as my results, so that I
don't miss announcements posted somewhere else.
*Accepted when:* the news card shows the latest items for my scope with a read state.

---

## Module 2 — Leader portal

One portal, two scopes: a team lead sees their own team, a sales chief sees all teams beneath them.

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-L-01 | The leader sees doors, yes, active donors, plan, deviation, quality and trend for their scope | `[DEMO]` |
| FR-L-02 | Results can be filtered by period, campaign and person | `[DEMO]` |
| FR-L-03 | The follow-up needs view lists people below an approved threshold, ordered by priority | `[DEMO]` |
| FR-L-04 | Each follow-up row states which rule fired and which numbers triggered it, in readable text, not a code | `[DEMO]` |
| FR-L-05 | Each row shows a suggested action: conversation, course, field observation or quality check | `[DEMO]` |
| FR-L-06 | The leader can accept, modify or reject each suggestion; all three outcomes are recorded | `[DEMO]` |
| FR-L-07 | Rejecting a suggestion requires a reason | `[DEMO]` |
| FR-L-08 | The system never takes a personnel action automatically; it only suggests | `[DEMO]` |
| FR-L-09 | Accepted suggestions become tracked measures with status, owner and deadline | `[DEMO]` |
| FR-L-10 | A measure can be closed with a short note recording the outcome after follow-up | `[DEMO]` |
| FR-L-11 | The leader sees aggregated course status and who is missing mandatory courses | `[DATA]` |
| FR-L-12 | The leader cannot change learning history, only follow up on it | `[DEMO]` |
| FR-L-13 | The leader can set and adjust team and period goals within permitted limits | `[DATA]` |
| FR-L-14 | Every threshold used by the follow-up engine is visible to the leader, with its owner | `[DEMO]` |

### User stories

**L-1.** As a sales chief, I want to see which of my promoters need attention this week and why, so that I
spend my time on the right conversations.
*Accepted when:* the list is prioritised, each row names the signal and shows the numbers behind it, and
I can open the person's trend from the row.

**L-2.** As a team lead, I want to disagree with a suggestion and record why, so that the system learns and
my judgement is documented.
*Accepted when:* rejecting requires a reason, the rejection is stored against the suggestion, and the
person doesn't reappear for the same signal in the same period without new data.

**L-3.** As a sales chief, I want to record what I did about a flagged promoter and what happened after, so
that follow-up is a process rather than a memory.
*Accepted when:* an accepted suggestion becomes a measure with an owner and a deadline, and closing it
requires a short outcome note.

**L-4.** As a team lead, I want to filter my team's results by campaign and period, so that I can compare
like with like when a promoter works two campaigns.
*Accepted when:* filters apply across every figure on the page and the active filter is visible in the
header.

**L-5.** As an employee representative reviewing this feature, I want to see that no decision is automated
and that every threshold is documented, so that the system is defensible under the consultation
requirement.
*Accepted when:* every flagged row shows its rule and threshold, the owner of that threshold is named,
and no screen performs an action on a person without a leader confirming it.

---

## Module 3 — Recruitment

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-R-01 | A candidate can be created with name, contact, source, date and owner | `[DEMO]` |
| FR-R-02 | Candidates progress through the agreed stages, with the stage set explicitly rather than inferred | `[DATA]` |
| FR-R-03 | Each candidate shows current status, owner, next activity and full history | `[DEMO]` |
| FR-R-04 | The list can be filtered by status, owner, source and campaign | `[DEMO]` |
| FR-R-05 | A board view groups candidates by stage | `[DATA]` |
| FR-R-06 | Overdue next-activities are surfaced on the recruiter front page | `[DEMO]` |
| FR-R-07 | Contract status is visible per candidate: not sent, sent, signed | `[DATA]` |
| FR-R-08 | Onboarding checklist progress is visible per new hire | `[DATA]` |
| FR-R-09 | Only users with recruitment permission see candidate data; promoters and customers never do | `[DEMO]` |
| FR-R-10 | When a candidate ends, access and retention are restricted according to the agreed rule | `[LATER]` |

### User stories

**R-1.** As a recruiter, I want to see every candidate I own and what I owe them next, so that nobody goes
cold because I forgot to call.
*Accepted when:* my front page lists my candidates with next activity and flags anything overdue.

**R-2.** As a recruiter, I want to move a candidate to the next stage and record what happened, so that
anyone picking up the file knows where it stands.
*Accepted when:* changing stage prompts for the minimum information for that stage and appends to the
history rather than overwriting it.

**R-3.** As a sales chief, I want to see how many candidates are in each stage for my region, so that I can
predict staffing.
*Accepted when:* the board view shows counts per stage filtered to my scope.

> **Blocked.** The eight stages in the plan are explicitly a preliminary proposal (clarification 6).
> Build the list view first — it works with any stage set. Hold the board view until the real stages are
> confirmed.

---

## Module 4 — Customer portal

External users. Separate app, separate host, 2FA mandatory, manual provisioning by email. Scope
confirmed in the meeting: donors acquired, total amount paid, campaign cost, with period, location and
organisation filters.

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-C-01 | The customer logs in with 2FA; access is not conditional on payment status | `[DEMO]` |
| FR-C-02 | The customer sees only their own campaigns; no cross-customer data is reachable by any means | `[DEMO]` |
| FR-C-03 | The report shows donors acquired, total amount paid and campaign cost for the selected filter | `[DEMO]` |
| FR-C-04 | Filters cover period (year, month, week), location and organisation | `[DEMO]` |
| FR-C-05 | Every figure carries its definition, data source and report date, reachable from the figure itself | `[DEMO]` |
| FR-C-06 | The customer can export the agreed report | `[DEMO]` |
| FR-C-07 | Which fields a customer may see is configuration per customer agreement, not a hardcoded view | `[DATA]` |
| FR-C-08 | Promoter-level information appears only where the customer's contract permits it | `[DATA]` |
| FR-C-09 | When corrections change a period's figures, the customer sees a notice stating what changed and when | `[DEMO]` |
| FR-C-10 | The interface uses no internal staff vocabulary — no teams, shifts, internal IDs or role names | `[DEMO]` |
| FR-C-11 | Campaign cost is hidden behind a flag until its definition is agreed | `[DEMO]` |
| FR-C-12 | Login credentials are provisioned manually by an administrator and delivered by email | `[DATA]` |

### User stories

**C-1.** As a charity campaign manager, I want to see how many donors were recruited for my campaign this
month, so that I can report to my board without emailing anyone.
*Accepted when:* I log in, my campaign is selected by default, and the figure matches the report I
previously received by email.

**C-2.** As a charity campaign manager, I want to know exactly what "donors acquired" counts, so that I can
answer a question from my finance director.
*Accepted when:* the definition, its data source and the report date are reachable from the figure in
one interaction.

**C-3.** As a charity campaign manager, I want to export the report, so that I can put it in a board pack.
*Accepted when:* the export contains the same figures, filters, report date and definitions shown on
screen.

**C-4.** As a charity campaign manager, I want to be told when a number I already reported has changed, so
that I'm not caught out by a correction.
*Accepted when:* a notice appears on the affected period stating what changed and when.

**C-5.** As AB Marketing's data controller, I want certainty that one customer can never see another's data,
so that the portal is contractually safe to open.
*Accepted when:* scope is enforced in the data layer such that a missing filter returns nothing rather
than everything, and this is tested explicitly in the pilot.

---

## Module 5 — Results and quality (shared)

Serves the promoter's own view and the leader's team view from the same figures.

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-Q-01 | Six KPIs are available: doors knocked, active donors, yes percentage, recruited donors, billable, loyalty | `[DATA]` |
| FR-Q-02 | Each KPI displays its definition version and owner on request | `[DEMO]` |
| FR-Q-03 | Figures are recalculated on correction without deleting the previous value | `[DATA]` |
| FR-Q-04 | The user sees last updated and a short explanation whenever a correction has applied | `[DEMO]` |
| FR-Q-05 | Report elements from Dashboard.xlsx are available for the correct promoter, team or campaign | `[DATA]` |
| FR-Q-06 | Where a figure counts approved data only, the screen says so | `[DEMO]` |

### User stories

**Q-1.** As a quality officer, I want a correction to flow through every view that used the old number, so
that no screen keeps showing a figure I've retracted.
*Accepted when:* correcting a record updates the promoter view, the leader view and the customer report,
each showing a correction notice.

**Q-2.** As a leader, I want to know which version of a definition produced a number, so that I can explain
a change that wasn't caused by performance.
*Accepted when:* every KPI figure can show its definition version and the date that version took effect.

---

## Module 6 — KPI dictionary

Small screen, disproportionate value: it forces the definition decisions that block the customer portal.

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-K-01 | Eight KPI definitions are listed with rule, version, effective-from date and owner | `[DEMO]` |
| FR-K-02 | Each definition shows who locked it and when | `[DEMO]` |
| FR-K-03 | Version history is visible with a diff between versions | `[DEMO]` |
| FR-K-04 | Each definition lists which screens and reports consume it | `[DEMO]` |
| FR-K-05 | Locking is a deliberate action requiring a note, with a warning that changes apply retroactively | `[DEMO]` |
| FR-K-06 | A preview shows what a proposed change would do to a past period before it is applied | `[LATER]` |

### User stories

**K-1.** As a quality owner, I want to see everywhere "active donor" is used before I change it, so that I
don't silently move a customer's report.
*Accepted when:* the definition page lists its consumers, and the lock dialog names them.

**K-2.** As a developer, I want the definition of each KPI to be settled and visible, so that I'm not
guessing what to compute.
*Accepted when:* all eight have an owner, a rule and a lock state, and unlocked ones are visibly flagged
as not ready.

---

## Module 7 — Import and corrections

Manual upload first, automation later, as agreed in the meeting.

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-I-01 | An administrator can upload a Dashboard.xlsx file | `[DEMO]` |
| FR-I-02 | The upload shows a preview with row counts and validation errors before committing | `[DEMO]` |
| FR-I-03 | Re-uploading the same file does not double-count | `[DATA]` |
| FR-I-04 | Run history shows file, period, rows accepted, rows rejected, who ran it and when | `[DEMO]` |
| FR-I-05 | Rejected rows appear in a queue with the reason and a route to resubmit | `[DEMO]` |
| FR-I-06 | A pending correction shows what it will affect before it commits: periods, KPIs, people, customer reports | `[DEMO]` |
| FR-I-07 | The audit log records reason, time, before value, after value and approver for every correction | `[DEMO]` |
| FR-I-08 | Automated ingestion replaces manual upload without changing the review and commit flow | `[LATER]` |

### User stories

**I-1.** As an administrator, I want to see what a file will change before I commit it, so that a bad export
doesn't corrupt a month of reporting.
*Accepted when:* preview shows counts and errors, and nothing is written until I confirm.

**I-2.** As an administrator, I want to know why rows were rejected and fix them, so that quietly missing
data doesn't become wrong numbers.
*Accepted when:* rejected rows are listed with a reason and can be resubmitted after correction.

**I-3.** As a support-facing colleague, I want to answer "did the import run" without asking a developer, so
that I can resolve a promoter's question the same day.
*Accepted when:* run history shows the last run per source in plain language with a clear success state.

---

## Module 8 — Administration and audit

### Functional requirements

| ID | Requirement | Demo |
|---|---|---|
| FR-A-01 | The administrator has a cross-organisation overview of customers, campaigns, departments, teams and users | `[DEMO]` |
| FR-A-02 | The administrator can manage users, roles and individual access grants | `[DATA]` |
| FR-A-03 | The administrator can create customer accounts and provision portal logins | `[DATA]` |
| FR-A-04 | The administrator can preview the platform as a selected role, and as a selected customer account | `[DEMO]` |
| FR-A-05 | An unmistakable persistent banner is shown throughout any preview session, with an exit control | `[DEMO]` |
| FR-A-06 | Every preview session is recorded in the audit log | `[DEMO]` |
| FR-A-07 | The audit log is filterable by date, actor, action type, affected person and area | `[DEMO]` |
| FR-A-08 | Audit entries show before and after values where a value changed | `[DEMO]` |
| FR-A-09 | Administrator access requires multi-factor authentication | `[DEMO]` |
| FR-A-10 | Integration health shows the last successful run of each import and scheduled job | `[LATER]` |

### User stories

**A-1.** As an administrator, I want to see exactly what a promoter sees, so that I can reproduce a reported
problem without asking for a screenshot.
*Accepted when:* preview renders that user's actual permitted views, a banner makes the state obvious,
and the session is logged.

**A-2.** As a compliance reviewer, I want one log covering corrections, access changes and exports, so that
an audit doesn't require six systems.
*Accepted when:* the log spans all areas and shows before and after values for changes.

---

## What the demo needs

The shortest path to a credible frontend demonstration:

1. **Shell** — login, permission-driven nav, page header with period, source and last-updated
2. **Promoter front page** — six cards on fixtures, mobile layout, approved-data labelling, one correction notice
3. **Leader follow-up needs** — three or four flagged rows with real explanation text and working accept / modify / reject
4. **Customer portal** — login, one campaign, three figures, filters, a definition popover, export button, campaign cost hidden behind the flag
5. **Recruitment list** — candidates with owner, next activity and history
6. **KPI dictionary** — eight rows, lock state, consumers listed

Modules 7 and 8 can be represented by a single admin screen each. What matters most in a demo is that
the four in the meeting's scope feel complete and that nothing on screen contradicts the access rules —
a customer view that shows a promoter's name will undo the rest of the demonstration.

---

## Open items blocking requirements

| # | Item | Blocks |
|---|---|---|
| 1 | Campaign cost definition | FR-C-11, the customer economics view |
| 2 | Active donor definition, per campaign | FR-Q-01, FR-C-03 |
| 3 | Yes percentage and revisit rule | FR-P-04, FR-Q-01 |
| 4 | "Not role-based" access — instead of roles, or layered on top | FR-S-03, FR-S-04, the whole shell |
| 5 | Actual recruitment stages | FR-R-02, FR-R-05 |
| 6 | Which promoter details each customer may see | FR-C-08 |
| 7 | Learning status: live or periodic sync | FR-P-08, FR-L-11 |
