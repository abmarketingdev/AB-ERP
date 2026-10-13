"use client";

import * as React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemePreference } from "@/lib/theme";

/**
 * Three states, shown as three buttons rather than a cycling toggle.
 *
 * A single toggle has to encode "system" somewhere, and the usual answer — long
 * press, or a third click — is a state nobody discovers. Three radio buttons
 * cost one extra icon of width and say exactly what the options are.
 */
const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Lyst", Icon: Sun },
  { value: "dark", label: "Mørkt", Icon: Moon },
  { value: "system", label: "Følg systemet", Icon: Monitor },
];

export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Fargetema"
      className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={`flex size-7 items-center justify-center rounded-md transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
