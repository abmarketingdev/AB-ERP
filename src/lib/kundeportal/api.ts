"use client";

/**
 * Kundeportalen (ekte, api-bygg): kundens egen innlogging mot hr-service /api/hr/kundeportal/.
 *
 * Helt adskilt fra de ansattes innlogging: eget token (fra hr, ikke Auth), lagret i
 * sessionStorage under egen nøkkel (borte når fanen lukkes), sendt bare til
 * /api/hr/kundeportal/. Ansatt-klienten (lib/api/client.ts) leser det aldri, og kundens
 * kall bærer aldri et ansatt-token.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { campaignReportSchema, type CampaignReport } from "@/types/customer";
import type { ReportFilterInput } from "@/lib/api/quality";

const BASE = `${process.env.NEXT_PUBLIC_API_BASE ?? ""}/api/hr/kundeportal`;
const TOKEN_KEY = "ab-kundeportal-okt";
const EVENT = "ab-kundeportal-okt-endret";

export class KundeError extends Error {
  constructor(public status: number, public detail: string, public field?: string) {
    super(detail);
  }
}

export function readKundeToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeKundeToken(token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* privat modus: økten varer da bare til siden lastes på nytt */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useKundeToken(): string | null {
  return React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readKundeToken,
    () => null,
  );
}

type Params = Record<string, string | undefined>;

export async function kundeFetch<T = unknown>(
  path: string,
  { method = "GET", body, token, params }: { method?: string; body?: unknown; token?: string | null; params?: Params } = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(params ?? {})) if (v) url.searchParams.set(k, v);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new KundeError(0, "Får ikke kontakt med kundeportalen. Sjekk nettet og prøv igjen.");
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* tomt svar */
  }
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "Noe gikk galt. Prøv igjen.";
    throw new KundeError(res.status, detail, typeof data.field === "string" ? data.field : undefined);
  }
  return data as T;
}

/** Et kall med kundens økt. 401 = økten er ute (utløpt, logget ut, tilgang fjernet) → glem tokenet. */
async function withSession<T>(token: string, path: string, params?: Params): Promise<T> {
  try {
    return await kundeFetch<T>(path, { token, params });
  } catch (e) {
    if (e instanceof KundeError && e.status === 401) storeKundeToken(null);
    throw e;
  }
}

export interface KundeMe {
  email: string;
  name: string;
  organisation: string;
  backup_codes_left: number;
}

export function useKundeMe() {
  const token = useKundeToken();
  return useQuery({
    queryKey: ["kundeportal", "me", token],
    queryFn: () => withSession<KundeMe>(token as string, "/auth/me/"),
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  });
}

export function useKundeReport(filter: ReportFilterInput) {
  const token = useKundeToken();
  const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) as Params;
  return useQuery({
    queryKey: ["kundeportal", "report", params, token],
    queryFn: async (): Promise<CampaignReport> => {
      const raw = await withSession<{ empty?: boolean; detail?: string }>(token as string, "/report/", params);
      if (raw.empty) throw new KundeError(200, raw.detail ?? "Ingen kampanjer er knyttet til kontoen ennå.");
      return campaignReportSchema.parse(raw);
    },
    enabled: !!token,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export async function kundeLogout(token: string | null) {
  if (token) {
    try {
      await kundeFetch("/auth/logout/", { method: "POST", token });
    } catch {
      /* økten er uansett borte lokalt */
    }
  }
  storeKundeToken(null);
}
