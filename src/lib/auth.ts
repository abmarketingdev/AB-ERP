import type { Session } from "./permissions";
import { IS_MOCK } from "./data-source";
import * as mock from "./mock-auth";
import { clearTokens, readToken, refreshAccessToken, storeTokens, REFRESH_KEY } from "./auth-tokens";
import { accessMeSchema } from "@/types/access";
import { sessionFromAccess } from "./session-from-access";

/**
 * The login, 2FA and session calls the shell uses — one facade over two modes.
 *
 * mock: the demo accounts in mock-auth.ts, unchanged.
 * api:  auth-service through the gateway (`/api/auth/…`, platform `erp`), and the
 *       session from recruitment-service's `/api/recruitment/access/me/`.
 *
 * Same return shapes in both modes, so the login page and the session guard do not
 * branch on the mode.
 */
export type LoginResult =
  | { ok: true; requires2fa: true; pendingToken: string }
  | { ok: true; requires2fa: false; token: string }
  | { ok: false; error: string };

const PLATFORM = "erp";

async function json(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function apiLogin(username: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password, platform: PLATFORM }),
    });
  } catch {
    return { ok: false, error: "Får ikke kontakt med innloggingen. Sjekk nettet og prøv igjen." };
  }
  const body = await json(res);
  if (res.status === 401) {
    // 27 addresses are shared by several accounts (2026-10-21). Auth narrows a shared
    // address by platform and password, but when that still leaves none or several it
    // answers a plain 401 — the username always works, so say so.
    return {
      ok: false,
      error: username.includes("@")
        ? "Feil e-post eller passord. Bruker du en delt e-postadresse? Logg inn med brukernavnet ditt."
        : "Feil brukernavn eller passord.",
    };
  }
  if (res.status === 403) return { ok: false, error: "Kontoen din har ikke tilgang til ERP. Kontakt en administrator." };
  if (res.status === 429) return { ok: false, error: "For mange forsøk. Vent litt og prøv igjen." };
  if (!res.ok) return { ok: false, error: "Innloggingen feilet. Prøv igjen." };
  if (body.must_set_password) {
    return { ok: false, error: "Du må sette passord først. Bruk lenken i velkomst-e-posten." };
  }
  if (body.two_factor_required && typeof body.pre_auth_token === "string") {
    return { ok: true, requires2fa: true, pendingToken: body.pre_auth_token };
  }
  if (typeof body.access === "string") {
    try {
      window.localStorage.setItem(REFRESH_KEY, String(body.refresh ?? ""));
    } catch {
      /* private mode */
    }
    return { ok: true, requires2fa: false, token: body.access };
  }
  return { ok: false, error: "Innloggingen feilet. Prøv igjen." };
}

async function apiVerify(pendingToken: string, code: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const trimmed = code.replace(/\s+/g, "");
  const res = await fetch("/api/auth/2fa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pendingToken}` },
    // A 6-digit code is TOTP; anything else is a one-time backup code.
    body: JSON.stringify({ method: /^\d{6}$/.test(trimmed) ? "totp" : "backup_code", code: trimmed }),
  });
  const body = await json(res);
  if (res.status === 429) return { ok: false, error: "For mange forsøk. Vent litt og prøv igjen." };
  if (!res.ok || typeof body.access !== "string") {
    return { ok: false, error: res.status === 401 ? "Feil kode. Prøv igjen." : "Kunne ikke bekrefte koden." };
  }
  try {
    window.localStorage.setItem(REFRESH_KEY, String(body.refresh ?? ""));
  } catch {
    /* private mode */
  }
  return { ok: true, token: body.access };
}

async function fetchAccess(token: string): Promise<Response> {
  return fetch("/api/recruitment/access/me/", { headers: { Authorization: `Bearer ${token}` } });
}

async function apiSession(token: string): Promise<Session | null> {
  let res = await fetchAccess(token);
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (!fresh) return null;
    res = await fetchAccess(fresh);
  }
  if (!res.ok) return null;
  const parsed = accessMeSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.error("[auth] /access/me/ did not match its schema", parsed.error.issues);
    return null;
  }
  return sessionFromAccess(parsed.data);
}

export function login(email: string, password: string): Promise<LoginResult> {
  return IS_MOCK ? mock.login(email, password) : apiLogin(email, password);
}

export function verifyTwoFactor(pendingToken: string, code: string) {
  return IS_MOCK ? mock.verifyTwoFactor(pendingToken, code) : apiVerify(pendingToken, code);
}

export function fetchSession(token: string): Promise<Session | null> {
  return IS_MOCK ? mock.fetchSession(token) : apiSession(token);
}

export function storeToken(token: string) {
  storeTokens(token);
}

/** Blacklists the refresh token at Auth (best effort), then forgets both tokens. */
export function logout() {
  if (!IS_MOCK) {
    let refresh: string | null = null;
    try {
      refresh = window.localStorage.getItem(REFRESH_KEY);
    } catch {
      /* nothing stored */
    }
    if (refresh) {
      void fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${readToken() ?? ""}` },
        body: JSON.stringify({ refresh }),
        keepalive: true,
      }).catch(() => undefined);
    }
  }
  clearTokens();
}

export { readToken, TOKEN_EVENT } from "./auth-tokens";
export { DEMO_ACCOUNTS, type DemoAccount } from "./mock-auth";
