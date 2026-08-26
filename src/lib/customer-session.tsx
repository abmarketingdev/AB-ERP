"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { usePreview } from "./preview";

/**
 * Isolated from lib/permissions.tsx and lib/mock-auth.ts on purpose — the
 * customer portal does not share a frontend, session, or nav shell with the
 * staff app (per the requirements doc). In a real deployment this would be
 * a separate Next app/host; here it's isolated at the code + storage level
 * (its own context, its own localStorage key) since both live in one repo
 * for the demo.
 */

export interface CustomerAccount {
  email: string;
  password: string;
  contactName: string;
  organisation: string;
  campaigns: string[];
}

/**
 * Two working portal logins, on two different agreements.
 *
 * The second one is not padding: it is how the agreement stops being a claim.
 * Signing in as Strømmestiftelsen shows three figures, no week view and no
 * fieldwork section, because that is what their contract says — the same code
 * rendering a different entitlement. The campaigns and the agreement itself
 * live on the account record in the mock database, which is also what the admin
 * screen edits, so the two surfaces cannot drift apart.
 */
export const CUSTOMER_DEMO_ACCOUNTS: CustomerAccount[] = [
  { email: "kontakt@rodekors.no", password: "kunde123", contactName: "Ingrid Haug", organisation: "Røde Kors", campaigns: ["Høstkampanjen 2026", "Vårkampanjen 2026"] },
  { email: "rapport@strommestiftelsen.no", password: "kunde123", contactName: "Bjarte Nes", organisation: "Strømmestiftelsen", campaigns: ["Strømmestiftelsen"] },
];

const TWO_FACTOR_CODE = "246810";
const TOKEN_KEY = "ab-erp-customer-token";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function customerLogin(email: string, password: string) {
  await delay(600);
  const account = CUSTOMER_DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!account || account.password !== password) {
    return { ok: false as const, error: "Feil e-post eller passord." };
  }
  return { ok: true as const, pendingToken: btoa(JSON.stringify({ email: account.email, verified: false })) };
}

export async function customerVerify2fa(pendingToken: string, code: string) {
  await delay(500);
  if (code.trim() !== TWO_FACTOR_CODE) {
    return { ok: false as const, error: "Feil kode. Prøv igjen." };
  }
  const payload = JSON.parse(atob(pendingToken));
  return { ok: true as const, token: btoa(JSON.stringify({ ...payload, verified: true })) };
}

export async function fetchCustomerSession(token: string): Promise<CustomerAccount | null> {
  await delay(350);
  try {
    const payload = JSON.parse(atob(token));
    if (!payload.verified) return null;
    return CUSTOMER_DEMO_ACCOUNTS.find((a) => a.email === payload.email) ?? null;
  } catch {
    return null;
  }
}

/** Storage events only reach *other* tabs; this one needs its own signal. */
export const CUSTOMER_TOKEN_EVENT = "ab-erp-customer-token-change";

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CUSTOMER_TOKEN_EVENT));
}

export function storeCustomerToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  announce();
}
export function readCustomerToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function clearCustomerToken() {
  localStorage.removeItem(TOKEN_KEY);
  announce();
}

const CustomerSessionContext = React.createContext<CustomerAccount | null>(null);

export function CustomerSessionProvider({ account, children }: { account: CustomerAccount | null; children: React.ReactNode }) {
  return <CustomerSessionContext.Provider value={account}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomerSession() {
  return React.useContext(CustomerSessionContext);
}

/**
 * The customer's session, as a query rather than effect-managed state.
 *
 * `pathname` stays in the key because the /kunde layout stays mounted across
 * client-side navigation: a guard that resolved once on mount would freeze its
 * verdict from before login and never re-check after. Keying on the path makes
 * "re-check on navigation" a property of the cache instead of an effect that
 * resets two pieces of state and hopes they land in the right order.
 *
 * The login page is excluded rather than special-cased inside the fetch — there
 * is nothing to guard there, and asking would only add a redirect loop.
 */
export function useCustomerSessionGuard(pathname: string) {
  const preview = usePreview();
  const previewAccount =
    preview?.type === "customer"
      ? CUSTOMER_DEMO_ACCOUNTS.find((a) => a.email === preview.key)
      : undefined;

  const token = useCustomerTokenValue();
  const guarded = pathname !== "/kunde/login";

  const query = useQuery({
    queryKey: ["customer", "self", "session", token, pathname],
    queryFn: () => fetchCustomerSession(token as string),
    enabled: guarded && !!token && !previewAccount,
    staleTime: Infinity,
    retry: false,
  });

  if (!guarded) return { account: undefined, redirect: false };
  if (previewAccount) return { account: previewAccount, redirect: false };
  if (!token) return { account: null, redirect: true };
  if (query.isPending) return { account: undefined, redirect: false };
  const account = query.data ?? null;
  return { account, redirect: account === null };
}

/** The stored portal token, read as an external store so signing out in one
 *  tab does not leave a live report open in another. */
function useCustomerTokenValue(): string | null {
  return React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(CUSTOMER_TOKEN_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(CUSTOMER_TOKEN_EVENT, onChange);
      };
    },
    () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
    () => null,
  );
}
