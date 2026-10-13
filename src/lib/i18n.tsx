"use client";

import * as React from "react";

/**
 * FR-S-07 — interface language, Norwegian or English.
 *
 * Three things this has to get right, and only the first is obvious:
 *
 * 1. **Strings.** A dictionary with Norwegian as the source language, because
 *    that is what the product is written in and what a translator would work
 *    from. Missing keys fall back to Norwegian rather than rendering a key name
 *    — a half-translated screen is recoverable, `nav.forside` on screen is not.
 *
 * 2. **Formatting.** The part people forget. Switching language has to switch
 *    `Intl`: `1 336` becomes `1,336`, `7,6 %` becomes `7.6%`, `21. aug. 2026`
 *    becomes `21 Aug 2026`. Numbers formatted in the wrong locale are not a
 *    cosmetic problem on a screen full of figures — a Norwegian reading `1,336`
 *    sees one point three three six.
 *
 * 3. **`<html lang>`.** Screen readers pick pronunciation from it, and it is a
 *    WCAG 3.1.1 requirement. It is set here rather than in the layout because
 *    the layout renders before the preference is known.
 *
 * Formatting also has to work outside React — `lib/format.ts` is called from
 * plain functions — so the active locale is mirrored into a module-level
 * variable that the provider keeps in step.
 */
export type Locale = "nb" | "en";

export const LOCALES: { value: Locale; label: string; intl: string }[] = [
  { value: "nb", label: "Norsk", intl: "nb-NO" },
  { value: "en", label: "English", intl: "en-GB" },
];

const STORAGE_KEY = "ab-erp-locale";

/** Mirrored for `lib/format.ts`, which is called outside the React tree. */
let activeIntlLocale = "nb-NO";
export function intlLocale(): string {
  return activeIntlLocale;
}

const LocaleContext = React.createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({ locale: "nb", setLocale: () => {} });

function readStored(): Locale {
  if (typeof window === "undefined") return "nb";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "nb" ? v : "nb";
  } catch {
    return "nb";
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // `useSyncExternalStore` rather than an effect: reading localStorage during
  // render would mismatch on hydration, and an effect would flash Norwegian.
  const locale = React.useSyncExternalStore(subscribe, readStored, () => "nb" as Locale);

  React.useEffect(() => {
    activeIntlLocale = LOCALES.find((l) => l.value === locale)?.intl ?? "nb-NO";
    document.documentElement.lang = locale === "en" ? "en" : "nb";
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the switch still applies for this page view */
    }
    activeIntlLocale = LOCALES.find((l) => l.value === next)?.intl ?? "nb-NO";
    emit();
  }, []);

  const value = React.useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/* A tiny external store so the preference is shared by every subscriber. */
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

export function useLocale() {
  return React.useContext(LocaleContext);
}

/**
 * Remounts the UI when the language changes.
 *
 * `formatNumber` and friends are plain functions, not hooks, so the hundreds of
 * components that call them are not subscribed to the locale and would keep
 * their Norwegian output until something unrelated re-rendered them. Switching
 * to English left `9 840` and `94,2 %` on screen next to English labels — worse
 * than not offering the switch, because it reads as correct.
 *
 * Making formatting a hook would mean touching every call site to solve a
 * problem that occurs at most a handful of times in a career. Remounting is the
 * honest trade: it costs the open panels and unsaved drafts on screen, which is
 * what a person changing interface language expects anyway.
 *
 * It sits *below* `QueryClientProvider` on purpose — remounting above it would
 * discard the query cache and refetch the entire app.
 */
export function LocaleScope({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  return <React.Fragment key={locale}>{children}</React.Fragment>;
}

/**
 * Translate. Norwegian is the source language, so `t("Lagre")` returns "Lagre"
 * under `nb` with no lookup and "Save" under `en`. Keying on the Norwegian
 * string keeps the call sites readable and means an untranslated string
 * degrades to correct Norwegian rather than to a key.
 */
export function useT() {
  const { locale } = useLocale();
  return React.useCallback(
    (nb: string, vars?: Record<string, string | number>) => {
      const out = locale === "nb" ? nb : (EN[nb] ?? nb);
      if (!vars) return out;
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        out,
      );
    },
    [locale],
  );
}

/**
 * English for the interface chrome — navigation, shared states, page furniture,
 * common actions. Body copy and domain explanations remain Norwegian and fall
 * back cleanly; translating them is a translator's job, not a developer's, and
 * inventing English for a works-council-facing explanation would be worse than
 * leaving it in the language it was reviewed in.
 */
const EN: Record<string, string> = {
  // Navigation
  Forside: "Home",
  Resultater: "Results",
  Ukeplan: "Week plan",
  "Hopp til innholdet": "Skip to content",
  Hovedmeny: "Main menu",
  Mål: "Goals",
  Kurs: "Courses",
  Nyheter: "News",
  Teamresultater: "Team results",
  Oppfølgingsbehov: "Follow-up needs",
  Tiltak: "Measures",
  Team: "Teams",
  Kandidater: "Candidates",
  Oversikt: "Overview",
  "KPI-ordbok": "KPI dictionary",
  Import: "Import",
  Korrigeringer: "Corrections",
  "Brukere og tilganger": "Users and access",
  Kunder: "Customers",
  Integrasjoner: "Integrations",
  "Forhåndsvis som": "Preview as",
  Revisjonslogg: "Audit log",
  Meny: "Menu",
  "Logg ut": "Sign out",
  Viser: "Viewing",
  "Alle team": "All teams",

  // Page furniture
  Periode: "Period",
  Kilde: "Source",
  Oppdatert: "Updated",
  Språk: "Language",

  // Shared states
  "Noe gikk galt": "Something went wrong",
  "Prøv igjen": "Try again",
  "Ingen data": "No data",
  "Ingen tilgang": "No access",
  "Laster…": "Loading…",
  Avbryt: "Cancel",
  Lagre: "Save",
  Lukk: "Close",
  Søk: "Search",
  Tilbake: "Back",
  "Vis alle": "Show all",
  Skjul: "Hide",
  Begrunnelse: "Reason",
  Eier: "Owner",
  Frist: "Deadline",
  Status: "Status",
  Person: "Person",
  Kampanje: "Campaign",

  // Roles
  Promoter: "Promoter",
  "Team lead": "Team lead",
  Salgssjef: "Sales chief",
  Rekrutterer: "Recruiter",
  Administrator: "Administrator",
};
