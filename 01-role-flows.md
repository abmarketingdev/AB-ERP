# 01 — Role flows

Screen-by-screen flows for each role. Every flow states the entry point, the screens, what the user
does, and what must be true for the screen to be correct.

Requirement IDs (`FR-P-01`, `S-1`) refer to `docs/requirements.md`.

---

## Shared shell

Every role except the customer runs inside the same shell.

```
Login  →  2FA (if required)  →  Nav resolution  →  Role landing page
```

**Login.** Email, password, `nb-NO` by default. One field error style. No role picker — the user's
identity determines what they get.

**2FA.** Six-digit code, auto-advance between inputs, paste support for the whole code. Mandatory for
customers and administrators.

**Nav resolution.** After auth, fetch `GET /me/navigation` and render exactly what it returns. Never
compute nav from role in the client — see `docs/03`.

**Shell layout.** Persistent left sidebar on desktop, bottom tab bar on mobile for the promoter. Top
bar holds the page title, the period/source/last-updated header, and the account menu.

**PageHeader is mandatory.** Every data screen renders:

```
Title                                    Periode: Juni 2026 ▾
Kilde: Dashboard.xlsx · Sist oppdatert 09:12
```

---

## 1. Promotør — promoter

Mobile-first. Assume outdoors, one-handed, gloved, poor signal. Nothing below 16px. Tap targets 44px.

### Flow

```
Login → Forside → [Resultater | Ukeplan | Mål | Kurs | Nyheter]
```

Six nav items. Leaderboards, coins, duels and achievements are **deferred** — do not render them, do not
grey them out.

### Forside

The flagship screen. Cards in this order — it's the order a promoter cares about at 08:00:

| # | Card | Content | FR |
|---|---|---|---|
| 1 | Ukeplan | Days across, doors and yes per day, today highlighted | FR-P-06 |
| 2 | Egne KPIer | Doors, yes-rate, active donors. Day/week/month toggle | FR-P-04 |
| 3 | Mål | Progress bar, behind/on track/ahead state, days remaining | FR-P-07 |
| 4 | Kurs | Incomplete and expiring only. Deep link out | FR-P-08, 09 |
| 5 | Nyheter | Latest two, link to full feed | FR-P-10 |

**Below the KPI card:** an approved-data line — `Kun godkjente salg · oppdatert 09:12` (FR-P-05).

**At the foot:** a correction notice when one applies — `2 salg justert etter kvalitetssjekk 12. juni`
(FR-P-11). Not a toast, not a notifications tab. Inline, persistent, dismissible per correction.

### Resultater

Own KPIs in detail. Period selector, trend chart, table by day. Every figure shows its definition on tap
(FR-Q-02). The promoter sees only their own ID — enforce in the query, not the render (FR-P-03).

### Ukeplan

Week grid, doors and yes per day, current day marked. Read-only in v1.

> Note: the promoter shift calendar discussed for the maps app is a different thing. This page is
> results per day, not scheduled shifts. Do not conflate them.

### Mål

Own goal, period, current value, expected pace. One chart: actual against expected pace over the period.

### Kurs

List from the learning platform. Sort: overdue → expiring → in progress → not started. Completed
collapses behind a toggle. Each row deep links out; the ERP never renders course content (FR-P-12 in
the plan's chapter 6 — the ERP does not replace the learning platform).

### Nyheter

Chronological, scoped to the promoter's department, campaign or everyone. Read state per item.

---

## 2. Leder — leader

Desktop-first. One portal, two scopes: team lead sees their own team, sales chief sees all teams
beneath them. **Scope is a parameter, not a separate build.**

### Flow

```
Login → Forside → Teamresultater → [person] → Oppfølgingsbehov → Tiltak → close with outcome
```

### Forside

Team summary tiles, the three highest-priority follow-ups, and a deviation trend chart. Everything links
deeper. No dead ends.

### Teamresultater

The analytical screen. Filters — period, campaign, person — live in the URL so a view is shareable
(FR-L-02).

Content: KPI tiles, trend chart, per-person table sortable by any column, deviation highlight. See
`docs/04` for exactly which charts and which analytics endpoints feed them.

### Oppfølgingsbehov

**The most constrained screen in the product.** It will be reviewed by an employee representative before
production, so build it as if that review is happening.

Each row:

```
Marius Hansen · Team Oslo Vest
Signal:      Under mål
Forklaring:  42 dører/dag mot terskel 60, 5 av siste 10 arbeidsdager
Forslag:     Feltobservasjon
Terskel eid av: Drift
[Godta]  [Endre]  [Avvis]
```

Rules that must hold:

- The explanation is **readable text naming the rule and the numbers** (FR-L-04). Not a score, not a
  percentage badge, not "risk: high".
- The threshold and its owner are visible (FR-L-14).
- Three actions, all recorded. Rejecting requires a reason (FR-L-06, FR-L-07).
- **Nothing happens to a person automatically** (FR-L-08). The screen suggests; the leader decides.

### Tiltak

Accepted suggestions become tracked measures: status, owner, deadline. Detail view shows the person's
trend, what was done, and the outcome after the follow-up period. Closing requires a short note
(FR-L-09, FR-L-10).

### Mål and Kurs

Goal editing within permitted limits. Aggregated course status with a list of who is missing mandatory
courses — follow-up only, never edit learning history (FR-L-11, FR-L-12).

---

## 3. Rekrutterer — recruiter

### Flow

```
Login → Forside → Kandidater → [candidate] → advance stage → Kontrakter → Onboarding
```

### Forside

My candidates, my next activities, anything overdue (FR-R-06). This is a work queue, not a dashboard.

### Kandidater

Filterable list — status, owner, source, campaign. Build this **before** the board view: it works with
any stage set, and the real stages aren't confirmed yet (clarification 6).

### Candidate detail

Current status, owner, next activity, and **append-only history** (FR-R-03). Advancing a stage prompts
for that stage's minimum information and appends — never overwrites.

### Pipeline

Board grouped by stage. Hold until stages are confirmed. Design it so the stage list is data.

### Kontrakter, Onboarding

Contract status per candidate: not sent / sent / signed. Onboarding checklist progress per new hire.
Both read from HR; the ERP surfaces, HR owns.

---

## 4. Kunde — customer

**Separate app. Separate layout. Separate shell. Separate host.** Do not share a navigation component
with the staff app — the isolation requirement is easier to demonstrate when the code paths never meet.

The user is a charity campaign manager. They log in monthly. Assume no training and no memory of the
last visit.

### Flow

```
Email invite → Set password → 2FA setup → Login → Kampanjerapport → Eksport
```

Provisioning is manual, by an administrator, delivered by email (FR-C-12). Access does not depend on
payment status (FR-C-01).

### Kampanjerapport

The whole product, effectively. If the customer has one campaign, this **is** the landing page — skip a
separate front page.

**Three headline figures** (FR-C-03), per the meeting's scope:

- Vervede givere — donors acquired
- Totalt innbetalt — total amount paid
- Kampanjekostnad — campaign cost *(behind a flag — definition unresolved, FR-C-11)*

**Filters** (FR-C-04): period (year / month / week), location (Oslo, Trondheim), organisation. Three
filter groups, not ten. Period and campaign inline; the rest collapse.

**Every figure carries its provenance** (FR-C-05). Tap the figure → definition, data source, report
date. Build this as a shared `<FigureWithDefinition>` from the start; retrofitting it onto forty
numbers is painful.

**Charts:** result against plan per month, accumulated against plan, recruited per week. Keep it to
three. See `docs/04`.

**Correction notice** (FR-C-09): when a period's figures change, a banner on that period stating what
changed and when. One sentence. Not a changelog.

### Eksport

One button. Excel and PDF. The export carries the same figures, filters, report date and definitions as
the screen (FR-C-06).

### Absolute rules

- Only own campaigns, enforced in the query layer so a missing filter returns nothing (FR-C-02)
- No staff vocabulary anywhere (FR-C-10)
- Promoter names only where configuration permits (FR-C-08)

---

## 5. Kvalitet og drift — quality and operations

### Flow

```
Login → Forside → Korrigeringer → [review impact] → approve/reject → KPI-ordbok
```

### Korrigeringer

The screen that makes the correction cascade operable. A pending correction shows **what it will affect
before it commits** (FR-I-06):

```
Korrigering: 3 salg avvist, kampanje Strømmestiftelsen, juni 2026

Påvirker:
  Perioder            juni 2026, akkumulert 2026
  KPIer               Aktive givere, Andel fakturerbare
  Personer            Marius Hansen (−3), Sondre Vik (−1)
  Kunderapporter      Strømmestiftelsen juni

[Godkjenn]  [Avvis]
```

### KPI-ordbok

Eight definitions. List left, detail right. Each shows rule, version, effective-from, owner, locked by,
locked at, version diff, and **which screens consume it** (FR-K-04). Locking is a modal requiring a note
and warning about retroactive effect (FR-K-05).

Small screen, disproportionate value — it forces the definition decisions blocking the customer portal.

---

## 6. Systemadministrator

### Flow

```
Login (2FA) → Forside → [Brukere | Tilganger | Kunder | Kampanjer | Import | Revisjonslogg]
                     → Forhåndsvis som → banner → exit
```

### Tilganger

**The new architectural surface.** If access is user-specific rather than role-based, this is where it
happens. Search a user → see effective permissions → see which came from role and which were set
individually → grant or revoke with a reason → audit entry (FR-S-04, FR-A-02).

### Import

Upload Dashboard.xlsx → column map → preview with counts and validation errors → commit → run history
(FR-I-01, 02, 04). Plus a **rejected rows queue** with reasons and a resubmit path (FR-I-05). The queue
is the screen nobody specs and everybody needs.

### Forhåndsvis som

Role and customer-account preview. A **persistent unmistakable banner** throughout the session with an
exit control (FR-A-05). Every session is an audit event (FR-A-06). The banner is what stops someone
forgetting they're in preview.

### Revisjonslogg

Filterable by date, actor, action type, affected person, area. Rows expand to show **before and after
values** (FR-A-08).

---

## Cross-role patterns

Build these once, in `components/patterns/`:

| Pattern | Used by | Note |
|---|---|---|
| `PageHeader` | every data screen | period, source, last-updated |
| `KpiTile` | promoter, leader, customer | value, label, delta, definition popover |
| `FigureWithDefinition` | customer, results | provenance on tap |
| `CorrectionNotice` | promoter, leader, customer | what changed, when |
| `ApprovedDataLabel` | anywhere counting approved sales | one line, consistent wording |
| `EmptyState` | everywhere | never a blank region |
| `PermissionGate` | everywhere | renders the no-access state, not nothing |
| `FilterBar` | leader, customer, recruiter | writes to URL search params |
| `HistoryTimeline` | candidate, measure, correction | append-only, newest first |
