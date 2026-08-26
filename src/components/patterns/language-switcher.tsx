"use client";

import { Check, Languages } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale, useT, LOCALES, type Locale } from "@/lib/i18n";

/**
 * FR-S-07 — the interface language control.
 *
 * Sits in the sidebar footer next to sign-out rather than in a settings page:
 * it is a preference somebody sets once, and burying a once-in-a-career control
 * behind a menu is how people conclude the product does not have it.
 *
 * Each option is written **in its own language** — "Norsk", not "Norwegian".
 * Someone who cannot read the current interface language still has to be able
 * to find their way out of it.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const current = LOCALES.find((l) => l.value === locale);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Språk")}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors duration-[120ms] hover:bg-white/[0.03] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
        >
          <Languages className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{current?.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-44 p-1.5">
        {LOCALES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLocale(l.value as Locale)}
            aria-pressed={locale === l.value}
            lang={l.value === "en" ? "en" : "no"}
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground transition-colors duration-[120ms] hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
          >
            <Check
              className={`size-3.5 shrink-0 ${locale === l.value ? "text-[var(--ab-accent-11)]" : "opacity-0"}`}
              aria-hidden
            />
            {l.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
