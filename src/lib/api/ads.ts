import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import {
  adListSchema, adMetaSchema, adSchema, adTemplateListSchema, publicAdSchema, wordingCheckSchema,
} from "@/types/ad";

/**
 * ANN-01 … ANN-06 against recruitment-service (`/api/recruitment/ads/`).
 * The same paths are served by MSW in mock mode (src/mocks/a3-handlers.ts).
 */

const ADS = `${API.recruitment}/ads`;
const PUBLIC = `${API.recruitment}/public`;
const okSchema = z.object({ ok: z.boolean() }).loose();

export function useAds() {
  return useQuery({ queryKey: qk.ads.list(), queryFn: () => apiGet(`${ADS}/`, adListSchema) });
}
export function useAd(id: string) {
  return useQuery({
    queryKey: qk.ads.ad(id),
    queryFn: () => apiGet(`${ADS}/${id}/`, adSchema),
    enabled: Boolean(id),
  });
}
export function useAdTemplates() {
  return useQuery({
    queryKey: qk.ads.templates(),
    queryFn: () => apiGet(`${ADS}/templates/`, adTemplateListSchema),
    staleTime: 5 * 60_000,
  });
}
export function useAdMeta() {
  return useQuery({
    queryKey: qk.ads.meta(),
    queryFn: () => apiGet(`${ADS}/meta/`, adMetaSchema),
    staleTime: 5 * 60_000,
  });
}

function invalidateAds(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["ads"] });
}

export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPost(`${ADS}/`, adSchema, input),
    onSuccess: () => invalidateAds(qc),
  });
}
export function usePublishAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; platforms: string[] }) =>
      apiPost(`${ADS}/${v.id}/publish/`, adSchema, { platforms: v.platforms }),
    onSuccess: () => invalidateAds(qc),
  });
}
export function useUnpublishAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; platforms?: string[] }) =>
      apiPost(`${ADS}/${v.id}/unpublish/`, adSchema, { platforms: v.platforms ?? [] }),
    onSuccess: () => invalidateAds(qc),
  });
}
/** ANN-02 manual mode: the id Finn gave the ad that was posted by hand. */
export function useMarkManualPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; platform: string; externalId: string }) =>
      apiPost(`${ADS}/${v.id}/publications/${v.platform}/manual/`, adSchema, { externalId: v.externalId }),
    onSuccess: () => invalidateAds(qc),
  });
}
/** «Prøv igjen» on a publication the board refused. */
export function useRetryPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; platform: string }) =>
      apiPost(`${ADS}/${v.id}/publications/${v.platform}/retry/`, adSchema, {}),
    onSuccess: () => invalidateAds(qc),
  });
}
/** SRS l.4: the server's own word list, so the form flags exactly what save would refuse. */
export function useWordingCheck() {
  return useMutation({
    mutationFn: (text: string) => apiPost(`${ADS}/wording-check/`, wordingCheckSchema, { text }),
  });
}

// ── public (no session) ─────────────────────────────────────────────────────

export function usePublicAd(publicId: string) {
  return useQuery({
    queryKey: ["public-ad", publicId],
    queryFn: () => apiGet(`${PUBLIC}/ads/${publicId}/`, publicAdSchema),
    enabled: Boolean(publicId),
    retry: false,
  });
}
export function useApply() {
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPost(`${PUBLIC}/apply/`, okSchema, input),
  });
}
