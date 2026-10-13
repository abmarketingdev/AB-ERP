"use client";

import * as React from "react";
import { Mascot } from "./mascot";

/**
 * The waiting screen.
 *
 * Every full-page wait in the product renders this, so the app has one loading
 * identity rather than four: the boot gate, both session gates, and the login
 * takeover. The mascot's greeting loop *is* the indicator — it runs only while
 * something is genuinely pending, which is the whole justification for letting
 * it loop at all (see `mascot.tsx`).
 *
 * The label is not optional decoration. The two session gates this replaces
 * rendered a bare mascot with no text and no ARIA, so a screen-reader user got
 * silence during a wait and a blind keyboard user had no way to tell a slow
 * load from a broken one. `Mascot` promotes the label to `role="status"`.
 */
export function MascotLoading({
  label = "Laster…",
  size = 112,
  className,
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-5 ${className ?? ""}`}>
      <Mascot state="thinking" size={size} label={label} />
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {/*
         * An indeterminate bar, not a percentage. Nothing here knows how far
         * along the request is, and a bar that fills to 90% and stops is worse
         * than no bar. This one just says "still working".
         */}
        <span className="block h-1 w-48 overflow-hidden rounded-full bg-foreground/10">
          <span className="mascot-loading-bar block h-full w-1/3 rounded-full bg-[var(--ab-accent-9)]" />
        </span>
      </div>
    </div>
  );
}

/**
 * Full-viewport version. `theme` exists because this can mount above the router,
 * before any layout has decided whether the page is dark — the staff app is dark
 * and the customer portal is light, and guessing wrong means a full-screen
 * colour flash the moment the real page arrives.
 */
export function MascotLoadingScreen({
  label,
  theme = "dark",
}: {
  label?: string;
  theme?: "dark" | "light";
}) {
  return (
    <div
      className={`${theme === "dark" ? "dark " : ""}flex min-h-screen items-center justify-center bg-background`}
    >
      <MascotLoading label={label} />
    </div>
  );
}
