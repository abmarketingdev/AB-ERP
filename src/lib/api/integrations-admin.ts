import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { API, apiGet, apiPatch, apiPost, apiPut } from "./client";
import { useStepUp } from "@/lib/step-up";

/**
 * §4 integration admin (recruitment-service `/integrations/`): status in plain words,
 * on/off without a deploy, write-only keys, «Send test», alerts. api mode only — the
 * mock demo keeps the FR-A-10 health view.
 */
const R = `${API.recruitment}/integrations`;
const KEY = ["recruitment", "integrations"] as const;

export const adminIntegrationSchema = z.object({
  name: z.string(),
  label: z.string(),
  group: z.string(),
  breaksWhat: z.string(),
  enabled: z.boolean(),
  provider: z.enum(["mock", "real"]),
  status: z.enum(["ok", "late", "failing", "off"]),
  lastSuccessAt: z.string().nullable(),
  lastFailureAt: z.string().nullable(),
  lastError: z.string(),
  consecutiveFailures: z.number(),
  pendingJobs: z.number(),
  hasSecrets: z.boolean(),
  settings: z.array(z.object({ key: z.string(), value: z.unknown() })),
  updatedAt: z.string(),
});
export type AdminIntegration = z.infer<typeof adminIntegrationSchema>;

export const adminAlertSchema = z.object({
  id: z.number(),
  integration: z.string(),
  label: z.string(),
  message: z.string(),
  consecutiveFailures: z.number(),
  createdAt: z.string(),
});

export function useAdminIntegrations() {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: () => apiGet(`${R}/`, z.array(adminIntegrationSchema)),
    refetchInterval: 30_000,   // a status page that only updates on reload is a screenshot
  });
}

export function useIntegrationAlerts() {
  return useQuery({
    queryKey: [...KEY, "alerts"],
    queryFn: () => apiGet(`${R}/alerts/`, z.array(adminAlertSchema)),
    refetchInterval: 30_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useToggleIntegration() {
  const stepUp = useStepUp();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { name: string; enabled: boolean }) =>
      stepUp.run(() => apiPatch(`${R}/${v.name}/`, adminIntegrationSchema, { enabled: v.enabled })),
    onSettled: invalidate,
  });
}

export function useSaveSecrets() {
  const stepUp = useStepUp();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { name: string; secrets: { key: string; value: string }[] }) =>
      stepUp.run(() => apiPut(`${R}/${v.name}/secrets/`, z.unknown(), { secrets: v.secrets })),
    onSettled: invalidate,
  });
}

const testResultSchema = z.object({ status: z.string(), ok: z.boolean(), detail: z.unknown() });

/** Enqueues a test job, then polls until the integration's worker has run it. */
export function useSendTest() {
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: async (name: string) => {
      const { jobId } = await stepUp.run(() => apiPost(`${R}/${name}/test/`, z.object({ jobId: z.string() })));
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const res = await apiGet(`${R}/${name}/test/${jobId}/`, testResultSchema);
        if (res.status === "done" || res.status === "failed") return res;
      }
      return { status: "pending", ok: false, detail: "Workeren har ikke svart på 30 sekunder. Er integrasjonen skrudd av?" };
    },
  });
}

export function useAckAlert() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => apiPost(`${R}/alerts/${id}/ack/`, z.unknown()),
    onSettled: invalidate,
  });
}
