# 04 — Analytics and charts

Which chart appears on which screen, what it's called, and which analytics endpoint will eventually
feed it. The analytics service already computes most of this — the frontend's job is to present it, not
to recompute it.

**Rule: no chart without a decision attached.** If a viewer can't act differently based on what the
chart shows, it's decoration. Cut it.

---

## Chart library

Recharts. Wrap every chart type once in `components/charts/` — never use Recharts primitives directly
in a screen. The wrapper owns: theming, `nb-NO` formatting, empty state, loading skeleton, reduced
motion, accessible summary.

```
components/charts/
  TrendLine.tsx        one or more series over time
  ComparisonBar.tsx    actual vs plan, grouped
  StackedBar.tsx       composition over time
  ProgressArc.tsx      single value against target
  DistributionBar.tsx  horizontal, categorical
  SparkLine.tsx        inline, no axes, for tiles and table rows
```

Six chart types total. If a screen wants a seventh, question the screen.

---

## Existing analytics endpoints

The analytics service is already built. These exist and can be mapped now.

| Endpoint | Returns | Used by |
|---|---|---|
| `/api/dashboard/v2/overview/` | KPI tiles for a range | Leader forside |
| `/api/dashboard/v2/stats/` | Aggregate stats | Leader forside |
| `/api/dashboard/v2/trends/` | Time series | Leader trend charts |
| `/api/dashboard/v2/campaign-health/` | Per-campaign health | Leader, admin |
| `/api/dashboard/v2/employees/doors-by-period/` | Per-person doors | Leader table |
| `/api/dashboard/v2/pace/` | Pace figures | Leader, promoter |
| `/api/dashboard/v2/employee-pace-series/` | Pace over time | Person detail |
| `/api/dashboard/deviations/` | Deviation from baseline | Follow-up engine |
| `/api/dashboard/analytics/work-time-stats/` | Knock-based work time | Leader |
| `/api/dashboard/analytics/thresholds/effective/` | Applicable thresholds | Follow-up explanation |
| `/api/employee/me/stats/` | Own KPIs | Promoter |
| `/api/employee/me/pace/` | Own pace | Promoter |
| `/api/employee/me/briefing/` | Daily briefing | Promoter forside |
| `/api/reports/table/` | Set-based report | Leader, customer |
| `/api/dashboard/v2/sales/summary/` | Sales roll-up | Leader, customer |

**Two things these do not provide today**, so mock them and flag them:

1. **Approved vs raw split.** The quality service currently publishes no events, so analytics counts
   raw `ja` markers. Every KPI type carries `approvedOnly` — mock it as `true` and design for it. When
   the backend wires the quality gate, values drop and the label explains why.
2. **Customer-facing figures.** Total paid and campaign cost have no source. Mock behind the flag.

---

## Promoter — charts

Minimal. A field worker on a phone needs numbers, not analysis.

| Screen | Chart | Type | Source |
|---|---|---|---|
| Forside | None | — | Cards only. Resist adding one. |
| Forside · Ukeplan | Doors per weekday | `ComparisonBar`, 5 bars, today highlighted | `me/stats` |
| Forside · KPI tiles | 7-day trend | `SparkLine` inside the tile, no axes | `me/pace` |
| Resultater | Doors and yes over period | `TrendLine`, two series, shared axis | `me/pace` |
| Mål | Actual against expected pace | `TrendLine`, actual solid, expected dashed | `me/pace` + goal |

**Never** put a leaderboard chart, a peer comparison or a percentile on the promoter app in v1.
Leaderboards are deferred, and individual ranking requires union consultation.

---

## Leader — charts

The analytical surface. Four charts maximum per screen.

### Forside

| Chart | Type | Decision it supports |
|---|---|---|
| Team doors, last 30 days | `TrendLine` | Is the team trending down? |
| Result against plan, this month | `ProgressArc` | Will we hit the month? |
| Deviation count, last 14 days | `ComparisonBar` | Is follow-up load rising? |

### Teamresultater

| Chart | Type | Decision |
|---|---|---|
| Result vs plan per month | `ComparisonBar`, grouped | Which months missed? |
| Accumulated vs plan | `TrendLine`, two series | Are we recoverable? |
| Recruited per week | `ComparisonBar` | Which weeks broke pattern? |
| Per-person table with sparkline per row | table + `SparkLine` | Who specifically? |

The per-person table matters more than any chart on this screen. Sortable by every column, sparkline in
each row, click through to the person.

### Person detail

| Chart | Type | Decision |
|---|---|---|
| Personal pace vs own baseline | `TrendLine`, baseline as a band | Is this a change or their normal? |
| Doors per day, last 30 | `ComparisonBar`, threshold line | How many days below? |

**The baseline band is the important one.** The follow-up engine flags deviation from a *personal*
baseline, not from a team average. The chart must show that, or the leader will misread a naturally
lower-volume promoter as underperforming.

---

## Follow-up needs — no charts

Deliberately. This screen is a list with readable explanations. A chart here invites the leader to
interpret rather than read the rule, and the rule is what has to be defensible under review.

The only visual: a `SparkLine` per row showing the trend that triggered the flag. No axes, no
interaction, purely context.

---

## Customer — charts

Three. The scope confirmed in the meeting is donors acquired, total paid, campaign cost.

| Chart | Type | Decision |
|---|---|---|
| Result against plan per month | `ComparisonBar`, grouped | Is the campaign delivering? |
| Accumulated against plan | `TrendLine`, two series | Where will it land? |
| Recruited per week | `ComparisonBar` | Which weeks performed? |

**Deliberately excluded** from the meeting's scope, despite being in the original plan: price
distribution, payment-method split, loyalty curve, billable status per month. Add later if the customer
asks; a monthly visitor doesn't want six charts.

Every chart carries the report date and definition in its footer.

---

## Admin — charts

Almost none. The admin dashboard is navigational, not analytical — the leader dashboard already does
analysis, and duplicating it creates two sources of truth for one number.

| Surface | Visual | Note |
|---|---|---|
| Forside | Count tiles with status colour | Active campaigns, active promoters today, pending corrections, failed imports |
| Import history | Table with a per-run status | Not a chart |
| Integration health | Status rows, green/amber/red | Plain language, no Redis terminology |

---

## Chart implementation rules

**Formatting.** `nb-NO` on every axis, tooltip and label. `7,6 %` not `7.6%`. `1 840` not `1,840`.
Dates as `12. jun` on axes, `12. juni 2026` in tooltips.

**Colour.** Two series maximum per chart unless the chart is explicitly a composition. Plan is always
the muted/dashed series; actual is always the solid accent one. Keep that consistent across every
screen — a leader shouldn't have to re-read the legend.

**Thresholds.** Where a threshold exists, draw it as a reference line with its value labelled. An
unlabelled line is noise.

**Empty and sparse data.** A chart with fewer than three points renders as a figure, not a chart. A
chart with no data renders the empty state, never empty axes.

**Accessibility.** Every chart has an `aria-label` summarising what it shows, plus a visually-hidden
table alternative for anything a decision depends on. Series distinguishable without colour — dash
patterns or direct labels.

**Animation.** Mount once at 320ms. Data changes morph at 200ms with a stable axis. Never re-animate on
filter change; a chart that redraws every time a filter moves is exhausting to use.

**Interaction.** Tooltip on hover and on tap. Legend toggles series where more than one exists. No zoom,
no pan, no brush in v1 — nobody asked for them and they complicate the mobile case.

---

## KPI tiles

The most-used component in the product. One implementation, used by promoter, leader and customer.

```
Dører banket                          ← label, secondary text
171                                   ← value, tabular numerals, large
↑ 12 mot forrige uke                  ← delta, coloured by direction
[sparkline]                           ← optional, 7 points, no axes
Kun godkjente salg · 09:12            ← approved label + last updated
```

Tapping the label opens the definition popover: rule, version, owner, data source, report date.

**Never animate the value counting up.** These are performance and financial figures. They appear at
their value.
