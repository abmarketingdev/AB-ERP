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

export const accessHandlers = [
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
