import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, apiUpload, API } from "./client";
import { qk } from "./keys";
import { candidateSchema } from "@/types/recruitment";

/**
 * One file for the modules the SRS adds, rather than seven near-identical ones.
 *
 * The house rule is a file per domain, and these are seven domains — but they
 * are also one feature that ships together, every hook is three lines, and
 * splitting them would mean seven files importing the same four helpers. If any
 * of them grows its own logic, it moves out.
 */

const okSchema = z.object({ ok: z.boolean() }).loose();

// ── Annonser (ANN) og Intervju (BOOK) — A3 ─────────────────────────────────
// Moved to their own files (they talk to recruitment-service and have grown
// their own logic); re-exported so existing imports keep working.
export * from "./ads";
export * from "./interviews";

// Onboarding (ONB) and Ansatte moved to ./onboarding.ts (A4, recruitment-service).

// ── Notater, vedlegg (KAND-06/09) ───────────────────────────────────────────

function invalidateCandidate(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: qk.recruitment.candidate(id) });
  qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    /**
     * KAND-09 — `visibleTo` (module keys) and `visibleToUsers` (people) set the audience;
     * `private` with neither picked means the private-notes module (HR, ledelse). The
     * server filters notes per viewer, so a hidden note never reaches this client.
     */
    mutationFn: (v: { id: string; body: string; visibleTo: string[]; visibleToUsers?: string[];
                      private?: boolean; author?: string }) =>
      apiPost(`${API.recruitment}/candidates/${v.id}/notes`, candidateSchema,
              { body: v.body, visibleTo: v.visibleTo, visibleToUsers: v.visibleToUsers ?? [], private: v.private }),
    onSuccess: (_d, v) => invalidateCandidate(qc, v.id),
  });
}

/** KAND-06 — upload a file (PDF, Word, image; ≤ 10 MB, checked on the server too). */
export function useAddAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name: string; kind: string; file?: File }) => {
      const form = new FormData();
      if (v.file) form.append("file", v.file, v.file.name);
      form.append("name", v.name);
      form.append("kind", v.kind);
      return apiUpload(`${API.recruitment}/candidates/${v.id}/attachments`, candidateSchema, form);
    },
    onSuccess: (_d, v) => invalidateCandidate(qc, v.id),
  });
}

/** Where a candidate's attachment downloads from (an authenticated GET). */
export function attachmentUrl(candidateId: string, attachmentId: string) {
  return `${API.recruitment}/candidates/${candidateId}/attachments/${attachmentId}`;
}

// GODK-04 stedfortreder moved to ./approval.ts (A4).

// ── LEAD-11 målgruppeeksport ────────────────────────────────────────────────

const audienceSchema = z.object({
  platform: z.string(),
  exported: z.number(),
  considered: z.number(),
  excludedNoConsent: z.number(),
  /** Only hashes ever leave the service; the API returns no sample of them. */
  sample: z.array(z.object({ hashedEmail: z.string() })).optional().default([]),
});

export function useAudienceExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { platform: "Meta" | "TikTok"; basis: "hired" | "qualified" | "performers" }) =>
      apiPost(`${API.recruitment}/leads/audience-export`, audienceSchema, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.quality.audit() }),
  });
}

// BEM / OPPG / DASH hooks live in staffing.ts, tasks.ts and recruitment-dashboard.ts (A5).
