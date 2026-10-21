"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { setStepUpToken } from "@/lib/auth-tokens";
import { IS_MOCK } from "@/lib/data-source";
import { StepUpDialog } from "@/components/patterns/step-up-dialog";

/**
 * IFK-04 «tofaktor for admin og godkjenner» as a step-up.
 *
 * Signing in to the ERP needs no second factor (platform `erp`). The moment someone does
 * something that needs it — approve a candidate, change access, erase personal data — the
 * server answers 403 `step_up_required`, and this asks for password + one-time code
 * against platform `erp-2fa` (require_2fa=True in Auth, so its token only says
 * twofa_verified after a real OTP). The resulting token lives in memory until it expires,
 * then the next sensitive action asks again.
 *
 *     const stepUp = useStepUp();
 *     await stepUp.run(() => apiPost(...));   // asks for 2FA only if the server demands it
 */
export { STEP_UP_PLATFORM } from "./step-up-api";

type Pending = { resolve: (ok: boolean) => void };

const StepUpContext = React.createContext<{ request: () => Promise<boolean> } | null>(null);

export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const queryClient = useQueryClient();

  const request = React.useCallback(
    () => new Promise<boolean>((resolve) => setPending({ resolve })),
    [],
  );

  function finish(token: string | null) {
    if (token) {
      setStepUpToken(token);
      // /access/me/ answers `mfa` from the bearer; refresh what the UI shows.
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "access"] });
    }
    pending?.resolve(Boolean(token));
    setPending(null);
  }

  return (
    <StepUpContext.Provider value={{ request }}>
      {children}
      {pending && <StepUpDialog onDone={finish} />}
    </StepUpContext.Provider>
  );
}

export function isStepUpRequired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    typeof error.body === "object" &&
    error.body !== null &&
    (error.body as { code?: unknown }).code === "step_up_required"
  );
}

export function useStepUp() {
  const ctx = React.useContext(StepUpContext);
  return {
    /** Ask for 2FA now. Resolves true once a verified token is in place. */
    request: ctx?.request ?? (async () => false),
    /** Run an action; if the server demands step-up, ask once and retry. */
    async run<T>(action: () => Promise<T>): Promise<T> {
      try {
        return await action();
      } catch (error) {
        if (IS_MOCK || !ctx || !isStepUpRequired(error)) throw error;
        if (!(await ctx.request())) throw error;
        return action();
      }
    },
  };
}

export { stepUpLogin, stepUpVerify, enrollStart, enrollConfirm } from "./step-up-api";
export type { StepUpLogin } from "./step-up-api";
