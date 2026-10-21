import { formatPhone } from "@/lib/format";

/** «912 34 567 · kari@eksempel.no» without a dangling separator when one is missing.
    Phone formatting itself is the shared `formatPhone` (A1, @/lib/format). */
export function contactLine(phone: string | null | undefined, email: string | null | undefined): string {
  return [formatPhone(phone), (email ?? "").trim()].filter(Boolean).join(" · ");
}
