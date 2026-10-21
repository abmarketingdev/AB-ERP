import { IS_MOCK } from "@/lib/data-source";

/**
 * Token storage and the one refresh path.
 *
 * Auth issues a short-lived access token and a refresh token. On a 401 the client
 * refreshes ONCE and replays the request; a second 401 means the session is really
 * over and the session guard sends the user to login (keeping their filters,
 * FR-S-08). Concurrent 401s share one refresh — five cards failing at once must not
 * fire five refreshes, and Auth's refresh endpoint is rate-limited.
 *
 * Mock mode keeps its own fake token under the same key, so nothing above this file
 * needs to know which mode it is in.
 */
export const TOKEN_KEY = "ab-erp-token";
export const REFRESH_KEY = "ab-erp-refresh";
export const TOKEN_EVENT = "ab-erp-token-change";

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOKEN_EVENT));
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  return read(TOKEN_KEY);
}

export function storeTokens(access: string, refresh?: string | null) {
  try {
    window.localStorage.setItem(TOKEN_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* private mode: the session lasts as long as the tab */
  }
  announce();
}

export function clearTokens() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* nothing stored */
  }
  announce();
}

let refreshing: Promise<string | null> | null = null;

/** One in-flight refresh at a time; resolves to the new access token or null. */
export function refreshAccessToken(): Promise<string | null> {
  if (IS_MOCK) return Promise.resolve(null);
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = read(REFRESH_KEY);
      if (!refresh) return null;
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { access?: string };
        if (!body.access) return null;
        storeTokens(body.access);
        return body.access;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * fetch() with the refresh-and-replay-once rule. The caller builds headers as usual;
 * on replay only the Authorization header is swapped for the new token.
 */
export async function authorizedFetch(input: string, init: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401 || IS_MOCK) return res;
  const fresh = await refreshAccessToken();
  if (!fresh) {
    clearTokens(); // the guard notices and redirects to /login
    return res;
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${fresh}`);
  return fetch(input, { ...init, headers });
}
