import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { API, apiGet, apiPost } from "./client";

/** §8.1 l.743 — the public opt-out link in every SMS. No login; the code is the only key. */
export const optOutSchema = z.object({ masked: z.string(), optedOut: z.boolean(), already: z.boolean() });

const url = (code: string) => `${API.recruitment}/public/optout/${encodeURIComponent(code)}/`;

export function useOptOutLink(code: string) {
  return useQuery({ queryKey: ["public", "optout", code], queryFn: () => apiGet(url(code), optOutSchema), retry: false });
}

export function useConfirmOptOut(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(url(code), optOutSchema),
    onSuccess: (data) => qc.setQueryData(["public", "optout", code], data),
  });
}
