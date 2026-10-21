import { z } from "zod";
import { API, apiGet, apiPatch } from "./client";
import type { AuditEntry, Permission, UserAccess } from "@/types/quality";

/**
 * recruitment-service's admin API (access, audit) mapped onto the ERP's existing
 * contracts (types/quality.ts), so /admin/tilganger and /admin/revisjonslogg work in api
 * mode without a component change (03-data-contract.md). Mock mode never reaches here.
 *
 * The server sends permission keys only as VALUES (never JSON object keys — the camelCase
 * renderer would rewrite `private_notes.read`), so `reasons` is rebuilt here from the
 * grant/revocation lists.
 */
const R = API.recruitment;

const grantSchema = z.object({
  key: z.string(),
  reason: z.string().optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
});

const serverUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
  role: z.string(),
  template: z.string().nullable(),
  team: z.string().nullable(),
  active: z.boolean(),
  mfa: z.boolean(),
  lastSeen: z.string().nullable(),
  roleDefaults: z.array(z.string()),
  granted: z.array(grantSchema),
  revoked: z.array(grantSchema),
  effective: z.array(z.string()),
  suggestedTemplate: z.string().nullable(),
});
type ServerUser = z.infer<typeof serverUserSchema>;

const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ count: z.number(), results: z.array(item) });

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** A grant whose window has passed (or not started) is not shown as held. */
function activeGrant(g: z.infer<typeof grantSchema>) {
  const d = today();
  return (!g.validFrom || g.validFrom <= d) && (!g.validUntil || g.validUntil >= d);
}

export function toUserAccess(u: ServerUser): UserAccess {
  const reasons: Record<string, string> = {};
  for (const g of [...u.granted, ...u.revoked]) if (g.reason) reasons[g.key] = g.reason;
  return {
    id: u.id,
    name: u.name,
    email: u.email || u.username,
    role: u.role,
    team: u.team,
    active: u.active,
    mfa: u.mfa,
    lastSeen: u.lastSeen,
    roleDefaults: u.roleDefaults,
    granted: u.granted.filter(activeGrant).map((g) => g.key),
    revoked: u.revoked.map((g) => g.key),
    reasons,
  };
}

export async function fetchUserAccess(): Promise<UserAccess[]> {
  const body = await apiGet(`${R}/access/users/`, page(serverUserSchema), { page_size: 2000 });
  return body.results.map(toUserAccess);
}

export async function fetchPermissionCatalogue(): Promise<Permission[]> {
  const schema = z.array(z.object({
    key: z.string(), label: z.string(), description: z.string(), area: z.string(), sensitive: z.boolean(),
  }));
  return apiGet(`${R}/access/catalogue/`, schema);
}

export async function patchPermission(vars: {
  id: string;
  permission: string;
  action: "grant" | "revoke" | "reset";
  reason: string;
}): Promise<UserAccess> {
  const body =
    vars.action === "grant"
      ? { grant: [{ key: vars.permission }], reason: vars.reason }
      : vars.action === "revoke"
        ? { revoke: [vars.permission], reason: vars.reason }
        : { reset: [vars.permission], reason: vars.reason };
  return toUserAccess(await apiPatch(`${R}/access/users/${vars.id}/`, serverUserSchema, body));
}

export async function patchUserActive(vars: { id: string; active: boolean; reason: string }): Promise<UserAccess> {
  return toUserAccess(
    await apiPatch(`${R}/access/users/${vars.id}/`, serverUserSchema, { active: vars.active, reason: vars.reason }),
  );
}

const serverAuditSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  area: z.string(),
  affected: z.string(),
  before: z.string().nullable().optional(),
  after: z.string().nullable().optional(),
  at: z.string(),
  ts: z.string(),
});

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const body = await apiGet(`${R}/audit/events/`, page(serverAuditSchema), { page_size: 500 });
  return body.results.map((e) => ({ ...e, before: e.before ?? undefined, after: e.after ?? undefined }));
}
