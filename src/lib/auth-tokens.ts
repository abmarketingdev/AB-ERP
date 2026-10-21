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
  stepUp = null;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* nothing stored */
  }
  announce();
}

/*
 * IFK-04 step-up token (platform `erp-2fa`, minted after a real OTP). Held in MEMORY only —
 * never localStorage, never refreshed (master decision): Auth's refresh would carry
 * twofa_verified for 7 days, so the proof must die with the access token (max 8 h) or the
 * tab, whichever comes first. While valid it replaces the normal token as the bearer: same
 * user, and recruitment-service accepts both platforms.
 */
let stepUp: { token: string; exp: number } | null = null;

function expOf(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function setStepUpToken(token: string) {
  stepUp = { token, exp: expOf(token) };
  announce();
}

export function clearStepUpToken() {
  if (stepUp) {
    stepUp = null;
    announce();
  }
}

export function hasStepUp(): boolean {
  if (stepUp && stepUp.exp - 30_000 < Date.now()) stepUp = null;
  return stepUp !== null;
}

/** The bearer every API call should send: the step-up token while valid, else the normal one. */
export function currentBearer(): string | null {
  return hasStepUp() ? stepUp!.token : readToken();
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
  if (stepUp) {
    // The step-up token expired or was revoked: drop it (never refresh it) and retry with
    // the normal session. The next sensitive action will ask for 2FA again.
    clearStepUpToken();
    const headers = new Headers(init.headers);
    const normal = readToken();
    if (normal) headers.set("Authorization", `Bearer ${normal}`);
    const retry = await fetch(input, { ...init, headers });
    if (retry.status !== 401) return retry;
  }
  const fresh = await refreshAccessToken();
  if (!fresh) {
    clearTokens(); // the guard notices and redirects to /login
    return res;
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${fresh}`);
  return fetch(input, { ...init, headers });
}
