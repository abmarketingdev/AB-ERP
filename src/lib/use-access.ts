"use client";

import { useQuery } from "@tanstack/react-query";
import { API, apiGet } from "@/lib/api/client";
import { accessMeSchema, type AccessMe } from "@/types/access";
import { readToken } from "./auth-tokens";

/**
 * The signed-in user's module access (SRS §2.2), from recruitment-service.
 *
 *     const { can, needsStepUp } = useAccess();
 *     if (can("approval.approve")) …
 *
 * Display only — every endpoint enforces the same keys server-side. `needsStepUp(k)`
 * is true when the user holds `k` but the server will still refuse it until they
 * confirm with a one-time code (IFK-04).
 */
export function useAccess() {
  const token = typeof window === "undefined" ? null : readToken();
  const query = useQuery({
    queryKey: ["recruitment", "access", "me", token],
    queryFn: () => apiGet(`${API.recruitment}/access/me/`, accessMeSchema),
    enabled: !!token,
    staleTime: 60_000,
  });
  const data: AccessMe | undefined = query.data;
  const held = new Set(data?.permissions ?? []);
  return {
    ...query,
    access: data,
    can: (key: string) => held.has(key),
    needsStepUp: (key: string) =>
      !!data && data.stepUpEnforced && data.stepUp.includes(key) && !data.mfa,
    stepUpDisabled: data ? !data.stepUpEnforced : false,
  };
}
