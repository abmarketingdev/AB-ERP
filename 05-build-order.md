# 05 — Build order

Sequenced so that each phase is demonstrable and nothing is built twice.

---

## Phase 0 — Foundation (before any screen)

Do not skip this to get to visible screens faster. Every hour here saves a day later.

1. Next.js 15 project, TypeScript strict, Tailwind, shadcn/ui initialised
2. Design tokens in `globals.css` and Tailwind config — surfaces, text, borders, radius, roles
3. `nb-NO` formatting helpers: `formatNumber`, `formatPercent`, `formatDate`, `formatWeek`, `formatCurrency`
4. `src/types/` — write the contract types from `docs/requirements.md` **before** any UI
5. `src/lib/api/client.ts` with Zod validation and the path prefixes from `docs/03`
6. TanStack Query provider, sensible defaults, error boundary
7. MSW with the `?scenario=` switch and realistic latency
8. `components/patterns/` — `PageHeader`, `EmptyState`, `PermissionGate`, `ApprovedDataLabel`
9. `components/charts/` — the six wrappers, each with all five states

**Done when:** a throwaway page renders a mocked KPI tile with correct Norwegian formatting, a working
loading skeleton, a working error state, and a definition popover.

---

## Phase 1 — Shell and auth

| Step | Screens | Requirements |
|---|---|---|
| 1 | Login, 2FA | FR-S-01, FR-S-02 |
| 2 | Shell layout: sidebar, top bar, mobile tab bar | FR-S-09 |
| 3 | Permission-driven nav from `me.navigation` | FR-S-03 |
| 4 | `PermissionGate` and no-access state | FR-S-05 |
| 5 | `PageHeader` wired into the layout | FR-S-06 |

**Done when:** logging in as each of the six mocked users produces a different, correct navigation
without a single role conditional in the frontend.

---

## Phase 2 — Promoter

The flagship, and the one that proves the design language. Mobile at 375px first.

| Step | Screen | Requirements |
|---|---|---|
| 1 | Forside — five cards | FR-P-01, 02, 06, 07 |
| 2 | KPI card with day/week/month, approved label | FR-P-04, 05 |
| 3 | `CorrectionNotice` | FR-P-11 |
| 4 | Resultater — trend, table, definitions | FR-Q-02 |
| 5 | Ukeplan, Mål | FR-P-06, 07 |
| 6 | Kurs, Nyheter | FR-P-08, 09, 10 |

**Done when:** the front page is usable one-handed on a phone, every card shows period/source/updated,
and the approved-data explanation is visible without tapping anything.

---

## Phase 3 — Leader

| Step | Screen | Requirements |
|---|---|---|
| 1 | Forside — tiles, three follow-ups, trend | FR-L-01 |
| 2 | Teamresultater — filters in URL, four charts, person table | FR-L-01, 02 |
| 3 | Oppfølgingsbehov — explanation text, three actions | FR-L-03, 04, 05, 06, 07, 08, 14 |
| 4 | Tiltak — tracked measures, close with outcome | FR-L-09, 10 |
| 5 | Person detail — baseline band chart | — |
| 6 | Mål, Kurs | FR-L-11, 12, 13 |

**Done when:** a flagged row reads as a sentence a works council could review — the rule, the numbers,
the threshold, the owner — and rejecting requires a reason.

---

## Phase 4 — Customer

Separate app, separate layout, separate shell.

| Step | Screen | Requirements |
|---|---|---|
| 1 | Invite → set password → 2FA → login | FR-C-01, 12 |
| 2 | Kampanjerapport — three figures, three filter groups | FR-C-03, 04 |
| 3 | `FigureWithDefinition` on every number | FR-C-05 |
| 4 | Three charts | — |
| 5 | Correction notice | FR-C-09 |
| 6 | Eksport | FR-C-06 |
| 7 | Økonomi behind the flag | FR-C-11 |

**Done when:** the app contains no staff vocabulary, every figure explains itself in one interaction,
and campaign cost is invisible with the flag off.

---

## Phase 5 — Recruitment

| Step | Screen | Requirements |
|---|---|---|
| 1 | Forside — my candidates, overdue | FR-R-06 |
| 2 | Kandidater — filterable list | FR-R-01, 04 |
| 3 | Candidate detail — append-only history | FR-R-03 |
| 4 | Stage advance with per-stage fields | FR-R-02 |
| 5 | Kontrakter, Onboarding | FR-R-07, 08 |

Board view held until real stages are confirmed. Design the stage list as data so it drops in.

---

## Phase 6 — Quality and admin

| Step | Screen | Requirements |
|---|---|---|
| 1 | KPI-ordbok — definitions, lock, consumers | FR-K-01…05 |
| 2 | Korrigeringer — impact preview before commit | FR-I-06 |
| 3 | Import — upload, preview, commit, history | FR-I-01, 02, 04 |
| 4 | Rejected rows queue | FR-I-05 |
| 5 | Tilganger — per-user permissions | FR-S-04, FR-A-02 |
| 6 | Forhåndsvis som — banner, exit, logged | FR-A-04, 05, 06 |
| 7 | Revisjonslogg — before/after values | FR-A-07, 08 |

---

## Demo readiness

If the demo comes before all six phases are done, this is the minimum that reads as a real product:

1. **Shell** — login, permission nav, page header
2. **Promoter forside** — on a real phone, not a resized browser window
3. **Leader oppfølgingsbehov** — three flagged rows with real explanation text, working actions
4. **Customer kampanjerapport** — one campaign, three figures, definition popover, export
5. **KPI-ordbok** — eight rows, lock state, consumers listed

Five screens, each complete with all five states, beats fifteen sketched ones. The single most
convincing thing you can show is that a figure explains where it came from — nobody expects that from
an internal tool, and it's the thing the whole plan is built around.

**Demo scenario.** Use `?scenario=` to prepare three: a healthy week, a week with four follow-ups
needed, and a failed import. Switching between them live demonstrates the states without staging data.

**What will undermine the demo:** a customer screen showing a promoter's name, a number without a period
label, a loading spinner that hangs, or an English string in a Norwegian interface. Check for those
specifically before presenting.

---

## Definition of done, per screen

- [ ] All five states: loading, empty, partial, error, no-access
- [ ] `PageHeader` with period, source, last-updated
- [ ] `nb-NO` formatting on every number and date
- [ ] Keyboard reachable, visible focus
- [ ] Reduced motion respected
- [ ] No `fetch` outside `lib/api/`
- [ ] No role conditional — permissions only
- [ ] Zod schema for every response consumed
- [ ] Requirement IDs referenced in the commit
