"use client";

import { FlaskConical, ShieldOff } from "lucide-react";
import { IS_MOCK } from "@/lib/data-source";
import { useAccess } from "@/lib/use-access";

/**
 * States, above every staff screen, the two things a tester must never miss:
 *
 * - MOCK: every number on the page is demo data from the browser (MSW), not the
 *   system. Shown only in mock mode, so in api mode nobody mistakes real data for a demo.
 * - 2FA off: the test environment runs with the IFK-04 step-up requirement disabled
 *   until Auth issues the `amr` claim. Without this banner, approving a candidate on
 *   test would look like proof that «tofaktor for godkjenner» works — it does not.
 */
export function EnvironmentBanner() {
  return IS_MOCK ? <MockBadge /> : <StepUpBanner />;
}

function MockBadge() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-secondary px-4 py-1 text-[12px] font-medium text-muted-foreground"
    >
      <FlaskConical className="size-3.5" aria-hidden />
      MOCK — demodata i nettleseren, ikke ekte tall
    </div>
  );
}

function StepUpBanner() {
  const { stepUpDisabled } = useAccess();
  if (!stepUpDisabled) return null;
  return (
    <div role="alert" className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-[13px] font-medium text-warning-foreground">
      <ShieldOff className="size-4" aria-hidden />
      2FA-krav er midlertidig av på test — godkjenning og admin her beviser ikke IFK-04
    </div>
  );
}
