"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "./permissions";
import { fetchSession, readToken, logout, TOKEN_EVENT } from "./auth";
import { MOCK_USERS } from "./mock-users";
import { usePreview } from "./preview";

export function clearSessionKey() {
  logout();
}

/**
 * Loads the session from `/me` — mocked, or recruitment-service's
 * `/api/recruitment/access/me/` in api mode (lib/auth.ts). The frontend never
 * reaches into a user object directly, matching FR-S-03.
 *
 * The gate is a **permission**, not a user key. Two roles legitimately share the
 * leader portal — a team lead and a sales chief both hold `leader.view` and see
 * the same screens at different scopes (doc 01). Matching on identity instead
 * would have forced a duplicate set of /salgssjef routes, which is exactly the
 * fork doc 01 says not to build.
 */
/**
 * FR-S-08 — an expired session returns the user to login **without losing the
 * current filter state**.
 *
 * Because every filter on this platform already lives in the URL — period,
 * campaign, person, team, view — preserving "where I was, filtered how I had
 * it" is the same problem as preserving the URL. So the guard stashes
 * `pathname + search` and login sends the user back to exactly that address.
 *
 * Stored rather than passed as a query parameter: a `?next=` on the login page
 * is an open-redirect waiting to happen, and it also leaks the filters into
 * anything that logs URLs. It is validated as a same-origin absolute path
 * before use regardless.
 */
const RETURN_KEY = "ab-erp-return-to";

export function stashReturnTo(url: string) {
  if (typeof window === "undefined") return;
  // Only ever an absolute path on this origin.
  if (!/^\/(?!\/)/.test(url) || url.startsWith("/login")) return;
  try {
    window.sessionStorage.setItem(RETURN_KEY, url);
  } catch {
    /* private mode — the user simply lands on their default page */
  }
}

export function takeReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(RETURN_KEY);
    window.sessionStorage.removeItem(RETURN_KEY);
    return v && /^\/(?!\/)/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * FR-S-05 — "not signed in" and "signed in, but not entitled" are different
 * answers and must not share a response.
 *
 * Bouncing an authenticated user to the login page for a permission they lack
 * tells them the opposite of the truth: they are logged in, and logging in
 * again will not help. They retry, they check their password, they file a
 * ticket. So only a missing session redirects; a session without the permission
 * gets a stated refusal rendered inside the user's *own* shell, with their own
 * navigation still there to leave by.
 *
 * `session` is the real one either way, which is what lets the denied case keep
 * a working shell around the refusal instead of a bare page.
 */
export interface GuardResult {
  /** undefined while resolving, null when redirecting to login. */
  session: Session | null | undefined;
  /** Signed in, but this portal is not theirs. */
  denied: boolean;
}

/**
 * The session is a query, not effect-managed state.
 *
 * It used to be `useState` seeded from an effect: render once with `undefined`,
 * resolve, render again — a cascading render on every guarded page, and the
 * lint rule that flags it was right. As a query it also stops re-fetching the
 * same token on every navigation, which is what it was doing.
 *
 * The redirect stays in an effect, because navigating is a side effect on an
 * external system (the router) and that is exactly what effects are for.
 */
export function useSessionGuard(requiredPermission?: string): GuardResult {
  const router = useRouter();
  const preview = usePreview();

  /*
   * An admin previewing a role short-circuits the token entirely — the preview
   * is the session for as long as it lasts. Resolved before the query so a
   * preview never waits on a fetch it does not need.
   */
  const previewed =
    preview?.type === "role" && requiredPermission
      ? MOCK_USERS[preview.key]
      : undefined;
  const previewSession =
    previewed?.permissions.includes(requiredPermission ?? "") ? previewed : undefined;

  const token = useToken();
  const query = useQuery({
    queryKey: ["auth", "self", "session", token],
    queryFn: () => fetchSession(token as string),
    enabled: !!token && !previewSession,
    staleTime: Infinity,
    retry: false,
  });

  // `undefined` while hydrating (storage not read yet) or while a real fetch is in flight.
  const session: Session | null | undefined = previewSession
    ? previewSession
    : token === undefined
      ? undefined
      : !token
        ? null
        : query.isPending
          ? undefined
          : (query.data ?? null);

  const denied =
    !!session && !!requiredPermission && !session.permissions.includes(requiredPermission);

  React.useEffect(() => {
    if (session !== null) return;
    // FR-S-08 — remember the whole address, filters included.
    stashReturnTo(window.location.pathname + window.location.search);
    router.replace("/login");
  }, [session, router]);

  return { session, denied };
}

/**
 * The stored token, read as an external store so a sign-out in another tab
 * invalidates this one rather than leaving a dead session on screen.
 *
 * The server snapshot is `undefined` ("not read yet"), not `null` ("no token"): during
 * hydration React renders with the server snapshot, and treating that as signed-out made
 * a reload of any protected page in api mode redirect to /login before the real token was
 * read (found by A2). Mock mode hid it — the MSW gate delays rendering past hydration.
 */
function useToken(): string | null | undefined {
  return React.useSyncExternalStore<string | null | undefined>(subscribeToken, readToken, () => undefined);
}

function subscribeToken(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(TOKEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(TOKEN_EVENT, onChange);
  };
}
