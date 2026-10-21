import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { API, apiDownload, apiGet, apiPost } from "./client";
import { useStepUp } from "@/lib/step-up";

/**
 * IFK-02 «Kandidaten kan be om innsyn og sletting, og admin kan gjennomføre det med ett klikk»
 * and IFK-01's 3-year rule. Everything needs privacy.admin, a step-up key: the first search
 * asks for 2FA. Search is by what the person gave when they asked — phone or e-mail.
 */
const P = `${API.recruitment}/privacy`;

export const subjectSchema = z.object({
  subjectRef: z.string(),
  found: z.boolean(),
  apps: z.array(z.object({ app: z.string(), items: z.number() })),
});
export const retentionRunSchema = z.object({
  id: z.number(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  dryRun: z.boolean(),
  cutoff: z.string(),
  found: z.number(),
  anonymised: z.number(),
  perApp: z.array(z.object({ app: z.string(), count: z.number() })),
  error: z.string(),
});

export function usePrivacySubject(q: string | null) {
  const stepUp = useStepUp();
  return useQuery({
    queryKey: ["privacy", "subject", q],
    queryFn: () => stepUp.run(() => apiGet(`${P}/subjects/`, subjectSchema, { q: q! })),
    enabled: !!q,
    retry: false,
  });
}

export function useRetentionRuns() {
  const stepUp = useStepUp();
  return useQuery({
    queryKey: ["privacy", "retention"],
    queryFn: () => stepUp.run(() => apiGet(`${P}/retention/`, z.array(retentionRunSchema))),
    retry: false,
  });
}

export function useExportSubject() {
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (q: string) => stepUp.run(async () => {
      const { requestId } = await apiPost(`${P}/export/`, z.object({ requestId: z.string() }), { q });
      return apiDownload(`${P}/export/${requestId}/download/`);
    }),
  });
}

export function useEraseSubject() {
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (v: { q: string; reason: string }) => stepUp.run(() =>
      apiPost(`${P}/erase/`, z.object({ requestId: z.string(), report: z.array(z.object({ app: z.string(), rows: z.number() })) }),
        { q: v.q, reason: v.reason, confirm: "SLETT" })),
  });
}

/** Human names for the parts of the system that hold personal data. */
export const APP_LABEL: Record<string, string> = {
  leads: "Leads i samleinnboksen",
  candidates: "Kandidatkort, notater og vedlegg",
  notify: "SMS og e-post sendt til personen",
  interviews: "Intervjuer",
  ads: "Søknader via annonser",
  approvals: "Godkjenninger",
  onboarding_bridge: "Onboarding",
  staffing: "Vaktplan og oppmøte",
  tasks: "Lederoppgaver",
};
