# 02 — Design system, motion and states

The six existing apps each have their own design language. This one does not inherit from any of them.
It is a single coherent system, and consistency across roles matters more than any individual screen
looking clever.

---

## Design intent

**Norwegian operational software, not a consumer dashboard.** The audience is field workers on phones,
team leads in an office, and charity managers who visit monthly. Nothing here rewards visual
flourish. It rewards legibility, obvious state, and figures you can trust at a glance.

Three adjectives to design against: **calm, legible, accountable.** Every number should look like it
knows where it came from.

Avoid: hero gradients, glassmorphism, dark-by-default, decorative illustration, oversized display type,
animated counters, confetti. This is a system people use eight hours a day and that will be reviewed by
a works council.

---

## Tokens

Define in Tailwind config and `globals.css` as CSS variables. Light and dark both supported; light is
default (field use in daylight).

**Surfaces** — page, card, raised, sunken. Four steps, no more.
**Text** — primary, secondary, muted, disabled.
**Borders** — hairline default, strong for emphasis. Hairlines everywhere; heavy borders never.
**Radius** — one control radius, one card radius. Two values.
**Roles** — accent (blue), success (green), warning (amber), danger (red), plus a neutral.

Semantic colour is reserved for meaning:

| Meaning | Where |
|---|---|
| Success | On track, approved, completed, signed |
| Warning | Approaching deadline, awaiting approval, flagged for follow-up |
| Danger | Overdue, rejected, failed import, correction reducing a figure |
| Accent | Selected state, primary action, current period |

Never use colour as the only signal. Every coloured state carries a label or an icon.

---

## Typography

- One sans family. `Inter` or the system stack. No second display face.
- Two weights only: 400 and 500. Never 600 or 700.
- Sentence case everywhere. Never Title Case, never all-caps labels.
- Minimum 16px on the promoter app. 14px is the floor elsewhere; 12px only for metadata lines.
- Tabular numerals on every figure, table and chart axis: `font-variant-numeric: tabular-nums`.
  Numbers that shift width as they update look broken.

**Norwegian formatting.** `nb-NO` throughout: `1 840` with a non-breaking space, `7,6 %` with a comma,
`12. juni 2026`, weeks as `uke 24`, currency as `kr 1 840`. Use `Intl`, never hand-rolled formatting.

---

## Layout

- Desktop content max width 1280px. Wider tables scroll within their container, never the page.
- Promoter app is a single column, always. No two-column phone layouts.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48. Nothing between.
- Cards: hairline border, card radius, generous internal padding. No shadows on in-flow cards —
  shadows only on floating layers (popover, dialog, sheet).
- Maximum two floating elevations on screen. A third means a dialog, not a popover on a popover.

---

## Motion

Motion here has one job: **explain what changed.** It never decorates and it never delays.

### Durations and easing

| Token | Value | Use |
|---|---|---|
| `fast` | 120ms | Hover, focus, tap feedback, tooltip |
| `base` | 200ms | Panel open, card expand, tab change |
| `slow` | 320ms | Route transition, drawer, chart mount |

Easing: `cubic-bezier(0.2, 0, 0, 1)` for entrances, `cubic-bezier(0.4, 0, 1, 1)` for exits. One
overshoot curve exists for confirmations only — use it sparingly.

### What animates

| Element | Motion | Note |
|---|---|---|
| Route change | 200ms fade + 8px rise on content | Sidebar and header stay fixed |
| Card mount | 200ms fade, 30ms stagger, max 6 items | Never stagger a long list |
| KPI value change | Colour flash on the delta only | **Never count up the number** |
| Chart mount | 320ms line draw or bar grow, once | Not on every filter change |
| Chart data change | 200ms morph between datasets | Keeps the axis stable |
| Filter apply | Content fades to 60% during fetch, no layout shift | Skeleton only on first load |
| Follow-up row action | Row collapses over 200ms, then list settles | Confirms the action happened |
| Correction notice | Slides in 200ms, stays until dismissed | Never auto-dismisses |
| Toast | 200ms in, 4s hold, 200ms out | Only for reversible actions |
| Sidebar nav | Instant active state, 120ms hover | Navigation must feel immediate |

### What never animates

- Numbers counting up from zero. Financial and performance figures appear at their value.
- Page load skeletons pulsing for more than one cycle before content.
- Anything on the customer portal beyond fade and chart mount. It's a report, not an experience.
- Loading spinners longer than 400ms without a skeleton replacing them.

### Reduced motion

Respect `prefers-reduced-motion` globally. Replace every transform with an opacity fade at `fast`.
Charts render at final state with no draw animation. This is not optional — field users on older
devices and accessibility reviewers both care.

---

## States

Every data surface has five states. Build all five or the screen isn't done.

**1. Loading.** Skeletons matching the final layout's shape and count. Never a centred spinner on a
full page. Never a layout that jumps when data lands.

**2. Empty.** A sentence explaining why it's empty and what to do. `Ingen oppfølgingsbehov denne uken.`
is a good empty state; a blank card is not.

**3. Partial.** Some data present, some pending — common with six upstream services. Show what exists,
mark what's pending inline. Never block the whole screen on the slowest source.

**4. Error.** What failed, in plain Norwegian, and a retry. Never a stack trace, never "Something went
wrong". `Kunne ikke hente resultater. Prøv igjen.`

**5. No access.** A permission gate renders an explicit message, not nothing. A user who sees a blank
region assumes a bug; a user who sees "Du har ikke tilgang til dette" understands.

---

## Accessibility

Not optional — this platform is subject to Norwegian workplace review.

- WCAG 2.1 AA contrast on every text and every chart series
- Full keyboard navigation; visible focus ring on every interactive element
- Charts have an accessible table alternative or `aria-label` summary
- Colour never the sole carrier of meaning
- Form errors announced, associated with their field, and inline
- Tap targets 44px minimum on the promoter app
- `lang="nb"` on the document, correct for the language toggle

---

## Component sourcing

Use shadcn/ui primitives unmodified where they fit. Wrap rather than fork. If a primitive needs a
project-wide change, change it in one place in `components/ui/` and note why.

The 21st.dev MCP is available for component search — use it for patterns you'd otherwise hand-roll
(command palette, data table, date range picker). Do not use it for anything that carries the design
identity of the product; those are built here.

The `ui-ux-pro-max` skill covers layout, colour and interaction conventions. Consult it when starting a
new screen type rather than mid-build.

---

## Design review checklist

Before any screen is considered done:

- [ ] All five states implemented
- [ ] `PageHeader` present with period, source, last-updated
- [ ] Norwegian formatting via `Intl` for every number and date
- [ ] Tabular numerals on figures
- [ ] Keyboard reachable end to end, visible focus
- [ ] Reduced motion respected
- [ ] Approved-data labelling where applicable
- [ ] No hardcoded role check — permissions only
- [ ] Mobile checked at 375px if the role is promoter
- [ ] For the customer app: no staff vocabulary anywhere on screen
