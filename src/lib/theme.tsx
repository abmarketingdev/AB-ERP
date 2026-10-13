"use client";

import * as React from "react";

/**
 * Light is the default, and that is a decision, not an oversight.
 *
 * `02-design-system.md`: "Light and dark both supported; light is default (field
 * use in daylight)." The staff shell had been shipping with `dark` hardcoded on
 * its wrapper, which meant the written design system and the running product
 * disagreed, and a promoter reading a shift plan outdoors got the worse of the
 * two. The class now lives on <html> and a person can choose.
 *
 * Three settings rather than two: "system" is what most people actually want,
 * and a product that only offers light/dark forces a choice the OS has already
 * made. The stored value is the *preference*, not the resolved theme — storing
 * "dark" when they picked "system" at night would freeze it there by morning.
 */

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "ab-erp-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>("light");
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  // Read the stored preference after mount. The inline script in the document
  // head has already applied the class, so there is no flash to repair here —
  // this only brings React's state into line with what is on screen.
  React.useEffect(() => {
    let stored: ThemePreference = "light";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      // Private mode or blocked storage. Light is a fine place to land.
    }
    setPreferenceState(stored);
    const next = stored === "system" ? (systemPrefersDark() ? "dark" : "light") : stored;
    setResolved(next);
    apply(next);
  }, []);

  // Only follow the OS while the preference actually is "system".
  React.useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      apply(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = React.useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
    const next = p === "system" ? (systemPrefersDark() ? "dark" : "light") : p;
    setResolved(next);
    apply(next);
  }, []);

  const value = React.useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // A component outside the provider should not crash the page over a colour.
    return { preference: "light", resolved: "light", setPreference: () => {} };
  }
  return ctx;
}

/**
 * Runs before first paint, so the page never renders light and then flips.
 *
 * It has to be inline and synchronous: anything loaded as a module runs after
 * the first paint, which is exactly the flash this exists to prevent.
 */
export const THEME_SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"light";
var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
if(d){document.documentElement.classList.add("dark");}
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){}})();`;
