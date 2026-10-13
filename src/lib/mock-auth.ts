import type { Session } from "./permissions";
import { MOCK_USERS } from "./mock-users";

/**
 * Simulated auth API. Shaped like the real endpoints will be (POST /login,
 * POST /2fa/verify, GET /me) so swapping in `lib/api/client.ts` later only
 * touches this file — no caller changes. Latency is simulated on purpose:
 * real network calls aren't instant, and the UI needs to prove it handles
 * that (loading states, disabled buttons) rather than assume 0ms responses.
 */

export interface DemoAccount {
  email: string;
  password: string;
  userKey: keyof typeof MOCK_USERS;
  requires2fa: boolean;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "kari@abmarketing.no", password: "promoter123", userKey: "promoter", requires2fa: false },
  { email: "ola@abmarketing.no", password: "leder123", userKey: "leader", requires2fa: false },
  { email: "marte@abmarketing.no", password: "salgssjef123", userKey: "saleschief", requires2fa: false },
  { email: "admin@abmarketing.no", password: "admin123", userKey: "admin", requires2fa: true },
  { email: "fredrik@abmarketing.no", password: "rekrutt123", userKey: "recruitment", requires2fa: false },
  // IFK-04 — "tofaktor for admin og godkjenner". The approver is the only
  // non-admin account with 2FA on, because the approval decision is the one
  // nobody else may make on their behalf.
  { email: "ole@abmarketing.no", password: "godkjenn123", userKey: "approver", requires2fa: true },
  { email: "lars@abmarketing.no", password: "ledelse123", userKey: "management", requires2fa: false },
];

const TWO_FACTOR_CODE = "123456";
const TOKEN_KEY = "ab-erp-token";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function issueToken(account: DemoAccount, verified: boolean) {
  return btoa(JSON.stringify({ userKey: account.userKey, verified, iat: Date.now() }));
}

export async function login(email: string, password: string): Promise<
  | { ok: true; requires2fa: true; pendingToken: string }
  | { ok: true; requires2fa: false; token: string }
  | { ok: false; error: string }
> {
  await delay(650);
  const account = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!account || account.password !== password) {
    return { ok: false, error: "Feil e-post eller passord." };
  }
  if (account.requires2fa) {
    return { ok: true, requires2fa: true, pendingToken: issueToken(account, false) };
  }
  return { ok: true, requires2fa: false, token: issueToken(account, true) };
}

export async function verifyTwoFactor(pendingToken: string, code: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  await delay(550);
  if (code.trim() !== TWO_FACTOR_CODE) {
    return { ok: false, error: "Feil kode. Prøv igjen." };
  }
  const payload = JSON.parse(atob(pendingToken));
  const token = btoa(JSON.stringify({ ...payload, verified: true }));
  return { ok: true, token };
}

export async function fetchSession(token: string): Promise<Session | null> {
  await delay(400);
  try {
    const payload = JSON.parse(atob(token));
    if (!payload.verified) return null;
    const user = MOCK_USERS[payload.userKey as string];
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Storage events only fire in *other* tabs, so a sign-in or sign-out in this
 * one needs its own signal. Without it the guard keeps reading a token that is
 * already gone until something else happens to re-render.
 */
export const TOKEN_EVENT = "ab-erp-token-change";

function announceToken() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  announceToken();
}

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  announceToken();
}
