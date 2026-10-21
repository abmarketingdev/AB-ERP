import { http, HttpResponse } from "msw";
import { MOCK_USERS } from "@/lib/mock-users";
import { VIEW_GATES } from "@/lib/session-from-access";
import type { AccessMe } from "@/types/access";

/**
 * Mock of recruitment-service's GET /api/recruitment/access/me/, same shape as the
 * real one (types/access.ts). The demo users hold screen gates (`leads.view`); the
 * server speaks `<modul>.<handling>`, so each gate is answered with the FIRST server
 * key listed for it in VIEW_GATES (lists are ordered least-privileged first) — never
 * all of them, or a promoter holding `schedule.view` would come back with the
 * leader's `staffing.manage`.
 */
function accessFor(userKey: string): AccessMe | null {
  const user = MOCK_USERS[userKey];
  if (!user) return null;
  const keys = new Set<string>();
  for (const gate of user.permissions) {
    const first = VIEW_GATES[gate]?.[0];
    if (first) keys.add(first);
  }
  const permissions = [...keys].sort();
  const stepUp = permissions.filter((k) => k === "approval.approve" || k.endsWith(".admin"));
  return {
    userId: user.userId,
    username: user.name,
    template: user.key,
    templateLabel: user.role,
    permissions,
    modules: [...new Set(permissions.map((k) => k.split(".")[0]))].sort(),
    stepUp,
    mfa: userKey === "admin" || userKey === "approver",
    stepUpEnforced: true,
    isSuperuser: userKey === "admin",
  };
}

// §8.1 l.743 demo: code DEMO1234 is a live link, anything else is invalid.
const optedOut = new Set<string>();
const optOut = (code: string) => ({ masked: "+47 9•• •• 470", optedOut: optedOut.has(code), already: false });

// IFK-02 demo: 912 34 567 / kari@eksempel.no exists, everything else is "not found".
const isKari = (q: string | null) => !!q && (q.replace(/\D/g, "").endsWith("91234567") || q.toLowerCase() === "kari@eksempel.no");
const retentionRuns = [{
  id: 3, startedAt: "2026-10-22T02:15:00+02:00", finishedAt: "2026-10-22T02:15:04+02:00", dryRun: true,
  cutoff: "2023-10-22", found: 14, anonymised: 0,
  perApp: [{ app: "leads", count: 9 }, { app: "candidates", count: 5 }], error: "",
}];

export const accessHandlers = [
  http.get("/api/recruitment/privacy/subjects/", ({ request }) => {
    const q = new URL(request.url).searchParams.get("q");
    return HttpResponse.json(isKari(q)
      ? { subjectRef: "s_kari", found: true, apps: [{ app: "leads", items: 1 }, { app: "candidates", items: 1 }, { app: "notify", items: 6 }, { app: "interviews", items: 1 }] }
      : { subjectRef: "s_none", found: false, apps: [] });
  }),
  http.get("/api/recruitment/privacy/retention/", () => HttpResponse.json(retentionRuns)),
  http.post("/api/recruitment/privacy/export/", () => HttpResponse.json({ requestId: "0b8f4f1e-1d1c-4a39-9a51-6a1f6f6c2c11", report: [] }, { status: 201 })),
  http.get("/api/recruitment/privacy/export/:id/download/", () => new HttpResponse(new Blob(["demo"]), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="innsyn-demo.zip"' } })),
  http.post("/api/recruitment/privacy/erase/", () => HttpResponse.json({ requestId: "x", report: [
    { app: "leads", rows: 1 }, { app: "candidates", rows: 1 }, { app: "notify", rows: 6 }, { app: "interviews", rows: 1 }] }, { status: 201 })),
  http.get("/api/recruitment/public/optout/:code/", ({ params }) =>
    String(params.code).toUpperCase() === "DEMO1234"
      ? HttpResponse.json(optOut("DEMO1234"))
      : HttpResponse.json({ message: "Lenken er ugyldig eller utløpt. Svar STOPP på SMS-en for å melde deg av." }, { status: 404 })),
  http.post("/api/recruitment/public/optout/:code/", () => {
    const already = optedOut.has("DEMO1234");
    optedOut.add("DEMO1234");
    return HttpResponse.json({ ...optOut("DEMO1234"), optedOut: true, already });
  }),
  http.get("/api/recruitment/access/me/", ({ request }) => {
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    try {
      const { userKey, verified } = JSON.parse(atob(token ?? "")) as { userKey?: string; verified?: boolean };
      const access = verified && userKey ? accessFor(userKey) : null;
      if (access) return HttpResponse.json(access);
    } catch {
      /* fall through */
    }
    return HttpResponse.json({ message: "Manglende autentiseringsinformasjon." }, { status: 401 });
  }),
];
