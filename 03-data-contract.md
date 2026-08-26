# 03 — Data contract

**This is the most important document in the project.** The backend does not exist. The frontend must
be built so that when it does, the only files that change are inside `src/lib/api/` and `src/mocks/`.

Read this before writing any data code.

---

## The rule

```
Component  →  typed hook  →  api client  →  MSW (today) / gateway (later)
                    ↑
              types/ — hand-written, the source of truth
```

A component never calls `fetch`. A component never knows a URL. A component receives typed data from a
hook and renders it. If you can't test a component by passing it props, the boundary is in the wrong
place.

---

## Types first

`src/types/` is written **before** the UI, from the requirements. Every response shape lives here.
These types are the contract you will hand to the backend team — treat them as a deliverable, not as
scaffolding.

```ts
// src/types/kpi.ts
export type KpiKey =
  | 'doors_knocked' | 'active_donors' | 'yes_rate'
  | 'recruited_donors' | 'billable' | 'loyalty';

export interface KpiValue {
  key: KpiKey;
  value: number;
  unit: 'count' | 'percent' | 'currency';
  period: PeriodRef;
  /** Only quality-approved records counted. Drives the approved-data label. */
  approvedOnly: boolean;
  definitionVersion: string;
  computedAt: string;          // ISO
  source: DataSource;
  delta?: { value: number; direction: 'up' | 'down' | 'flat' };
}

export interface PeriodRef {
  granularity: 'day' | 'week' | 'month' | 'custom';
  from: string;                // ISO date
  to: string;
  label: string;               // 'Juni 2026', 'Uke 24'
}

export type DataSource =
  | 'maps' | 'hr' | 'qc' | 'learning' | 'analytics' | 'dashboard_xlsx';
```

**Three fields appear on nearly every response** and exist because the requirements demand them:
`period`, `source`, `computedAt`. If a shape you're defining lacks them, check whether the screen needs
a `PageHeader` — it almost certainly does.

`approvedOnly` and `definitionVersion` exist for the same reason. Do not drop them from mock data
because they're inconvenient.

---

## The client boundary

One file. Everything goes through it.

```ts
// src/lib/api/client.ts
export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(res.status, await safeBody(res));
  return schema.parse(await res.json());   // runtime validation, always
}
```

**Zod-validate every response.** When the real backend arrives and a field is named differently or a
date is a number instead of a string, you want a loud parse error at the boundary, not a silent
`undefined` three components deep.

Path prefixes match the eventual gateway so nothing changes later:

| Domain | Prefix |
|---|---|
| Identity, nav, permissions | `/api/auth/` |
| Field data, campaigns, areas | `/api/maps/` |
| Teams, profiles, recruitment | `/api/hr/` |
| Quality, corrections | `/api/qc/` |
| KPIs, dashboards, trends | `/api/dashboard/` |
| Courses, progress | `/api/learning/` |
| Customers, reports, economics | `/api/customer/` |

Note `/api/dashboard/` keeps its prefix — the existing analytics service does not strip it. The others
do. Getting this right now avoids a rename later.

---

## Hooks, one file per domain

```ts
// src/lib/api/kpi.ts
export function usePromoterKpis(period: PeriodRef) {
  return useQuery({
    queryKey: ['kpi', 'promoter', 'me', period.from, period.to],
    queryFn: () => apiGet('/api/dashboard/api/employee/me/stats/', kpiListSchema, {
      from: period.from, to: period.to,
    }),
    staleTime: 60_000,
  });
}
```

Query key convention: `[domain, scope, subject, ...params]`. Consistent keys make invalidation after a
correction a one-liner.

---

## Mocks

MSW, in `src/mocks/`. Same handlers serve dev and tests.

```ts
// src/mocks/handlers/kpi.ts
export const kpiHandlers = [
  http.get('/api/dashboard/api/employee/me/stats/', ({ request }) => {
    const period = periodFromRequest(request);
    return HttpResponse.json(generatePromoterKpis(period));
  }),
];
```

**Fixtures must be realistic or the design will be wrong.** Specifically:

- Norwegian names, Oslo and Trondheim locations, real campaign names (Strømmestiftelsen, Norsk
  Folkehjelp, NRC, NFFH)
- Yes-rates between 4% and 12%, not 50%
- Doors per day between 40 and 90
- Some promoters below threshold, some above — the follow-up screen needs both
- At least one correction applied, so `CorrectionNotice` is exercised
- At least one KPI whose `approvedOnly` is true and whose value is visibly lower than the raw count
- Long Norwegian names that break layouts: `Kristoffer Bjørnstad-Sæther`
- One empty case per list, one error case reachable by a query param

Add a `?scenario=` param to handlers so a demo can switch between "everything healthy", "several
follow-ups needed" and "import failed" without changing code.

**Latency.** Add 150–400ms of delay. A frontend built against instant responses always has broken
loading states.

---

## Swapping to the real backend

When APIs arrive:

1. Point `NEXT_PUBLIC_API_BASE` at the gateway
2. Disable MSW in dev
3. Fix the Zod parse errors that surface
4. That is all

If step 3 requires touching a component, the boundary leaked. Fix the boundary, not the component.

Keep MSW enabled in tests permanently.

---

## Permissions

The client asked for granular, user-specific access rather than role-based. Build for that.

```ts
// src/types/auth.ts
export interface Me {
  userId: string;
  displayName: string;
  /** Defaults come from role; individual grants and revokes are already applied server-side. */
  permissions: string[];         // e.g. 'leader.followup.read'
  navigation: NavItem[];         // resolved server-side — render as given
  scope: {
    teamIds: string[];
    campaignIds: string[];
    customerId?: string;         // set only for external users
  };
}
```

**Never compute nav from role in the client.** Render `me.navigation` as returned. When the backend
resolves permissions differently later, the frontend doesn't change.

`<PermissionGate permission="leader.followup.read">` wraps protected regions and renders the no-access
state when absent — not `null`.

**Open question to flag, not to guess:** whether "not role-based" means instead of roles or layered on
top. This type supports both. If the client clarifies, only the mock changes.

---

## Filters in the URL

Every filterable screen keeps its filters in search params. A leader shares a link; the recipient sees
the same view. Use `nuqs` or hand-rolled `useSearchParams` helpers — but be consistent.

```
/leder/teamresultater?period=2026-06&campaign=stromme&person=all
```

---

## Errors

`ApiError` carries status and a parsed body. Map to user-facing Norwegian at the component boundary,
never in the client.

| Status | UI |
|---|---|
| 401 | Redirect to login, preserve the return path |
| 403 | No-access state, not a redirect |
| 404 | Empty state for the resource |
| 422 | Field errors inline on the form |
| 5xx | Error state with retry |

---

## What to hand the backend team

When this frontend is done, `src/types/` plus the MSW handlers **are** the API specification. Export
them as an OpenAPI document if useful, but the types are the contract. Building them carefully now is
the difference between a two-day integration and a two-week one.
