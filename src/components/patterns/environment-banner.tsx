"use client";

import { ShieldOff } from "lucide-react";
import { IS_MOCK } from "@/lib/data-source";
import { useAccess } from "@/lib/use-access";

/**
 * States, above every staff screen, what a tester must never miss in api mode: the
 * environment runs with the IFK-04 step-up requirement disabled. Without this banner,
 * approving a candidate on test would look like proof that «tofaktor for godkjenner»
 * works — it does not. (Mock mode has its own marker, MockBadge in the root layout.)
 */
const SHOW_PAUSE_BANNER = false;

export function EnvironmentBanner() {
  return IS_MOCK ? null : <StepUpBanner />;
}

function StepUpBanner() {
  const { stepUpDisabled } = useAccess();
  // Hidden on order 09.11.2026 while the step-up is paused in production: the client
  // does not want the warning shown. Flip SHOW_PAUSE_BANNER back to true to restore it.
  if (!SHOW_PAUSE_BANNER || !stepUpDisabled) return null;
  return (
    <div role="alert" className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-[13px] font-medium text-warning-foreground">
      <ShieldOff className="size-4" aria-hidden />
      2FA-krav er midlertidig av på test — godkjenning og admin her beviser ikke IFK-04
    </div>
  );
}
