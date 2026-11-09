"use client";

/**
 * ERP «Kunder» og «Forhåndsvis som kunde» (ekte, api-bygg). Kallene går til recruitment-service,
 * som sjekker tilgangsnøkkelen customers.admin (step-up) og sender videre til hr-service sin
 * kundeportal. Svarene er camelCase (recruitment sin renderer).
 */
import * as React from "react";
import { z } from "zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, apiGet, apiSend } from "@/lib/api/client";
import { useStepUp } from "@/lib/step-up";
import { campaignReportSchema, type CampaignReport } from "@/types/customer";
import type { ReportFilterInput } from "@/lib/api/quality";

const BASE = `${API.recruitment}/kundeportal/admin`;

export const kundeUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  isActive: z.boolean(),
  passwordSet: z.boolean(),
  twofaEnrolled: z.boolean(),
  invitedAt: z.string().nullable(),
  invitedBy: z.string(),
  lastLoginAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  revokedBy: z.string(),
  createdAt: z.string().nullable(),
});
export type KundeUser = z.infer<typeof kundeUserSchema>;

export const kundeAgreementSchema = z.object({
  figures: z.array(z.string()),
  granularities: z.array(z.string()),
  fieldworkDetail: z.string(),
  costDefinitionAgreed: z.boolean(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string(),
});
export type KundeAgreement = z.infer<typeof kundeAgreementSchema>;

export const kundeOrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  orgNumber: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  createdBy: z.string(),
  campaigns: z.array(z.object({ id: z.string(), name: z.string() })),
  agreement: kundeAgreementSchema,
  users: z.array(kundeUserSchema),
});
export type KundeOrg = z.infer<typeof kundeOrgSchema>;

const campaignSchema = z.object({ id: z.string(), name: z.string(), isActive: z.boolean() });
const KEY = ["kundeportal-admin"] as const;

export function useKundeOrgs() {
  const stepUp = useStepUp();
  return useQuery({
    queryKey: [...KEY, "orgs"],
    queryFn: () => stepUp.run(() => apiGet(`${BASE}/organisations/`, z.array(kundeOrgSchema))),
    retry: false,
  });
}

export function useKundeCampaigns() {
  const stepUp = useStepUp();
  return useQuery({
    queryKey: [...KEY, "campaigns"],
    queryFn: () => stepUp.run(() => apiGet(`${BASE}/campaigns/`, z.array(campaignSchema))),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

type Method = "POST" | "PATCH";

/** Én mutasjon for alle admin-handlingene; oppdaterer lista etterpå. */
export function useKundeAdminAction() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: ({ method, path, body }: { method: Method; path: string; body?: unknown }) =>
      stepUp.run(() => apiSend(method, `${BASE}/${path}`, z.unknown(), body ?? {})),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Hvilken organisasjon forhåndsvisningen gjelder (leses av usePreviewReport). */
export const PreviewOrgContext = React.createContext<string | null>(null);

export function usePreviewReport(filter: ReportFilterInput) {
  const orgId = React.useContext(PreviewOrgContext);
  const stepUp = useStepUp();
  const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) as Record<string, string>;
  return useQuery({
    queryKey: [...KEY, "preview", orgId, params],
    queryFn: async (): Promise<CampaignReport> => {
      const raw = await stepUp.run(() =>
        apiGet(`${BASE}/organisations/${orgId}/preview-report/`, z.record(z.string(), z.unknown()), params),
      );
      if (raw.empty) throw new Error(String(raw.detail ?? "Ingen kampanjer er knyttet til kontoen ennå."));
      return campaignReportSchema.parse(raw);
    },
    enabled: !!orgId,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

const DATE = new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
const TIME = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" });

export function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${DATE.format(d)} kl. ${TIME.format(d)}`;
}

/** «erp:admin_lars» / «hr:ole» → «admin_lars». */
export function actorName(actor: string): string {
  return actor.replace(/^(erp|hr):/, "");
}
