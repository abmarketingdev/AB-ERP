/**
 * R1 (kunden 12.11) — «Glemt passord?». Two PUBLIC calls to the platform's login service
 * through the gateway (`/api/auth/password-reset` and `…/confirm`), the same flow Maps uses.
 * The request always gets the same generic answer (no account enumeration) and the service
 * allows 5 requests per hour per address. `platform: "erp"` lets the service link the e-mail
 * back to this site's /reset-password. In mock mode both calls just succeed.
 */
import { IS_MOCK } from "./data-source";

export const GENERIC_MESSAGE =
  "Hvis det finnes en konto med den e-postadressen, har vi sendt en lenke for å lage nytt passord.";

export type RequestResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordReset(email: string): Promise<RequestResult> {
  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true };
  }
  let res: Response;
  try {
    res = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), platform: "erp" }),
    });
  } catch {
    return { ok: false, error: "Får ikke kontakt med innloggingen. Sjekk nettet og prøv igjen." };
  }
  if (res.status === 429) return { ok: false, error: "For mange forsøk. Vent en time og prøv igjen." };
  if (res.status === 400) return { ok: false, error: "Skriv inn en gyldig e-postadresse." };
  if (!res.ok) return { ok: false, error: "Noe gikk galt. Prøv igjen." };
  return { ok: true };
}

export type ConfirmResult = { ok: true } | { ok: false; invalidLink: boolean; error: string };

export async function confirmPasswordReset(uid: string, token: string, newPassword: string): Promise<ConfirmResult> {
  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return uid === "demo"
      ? { ok: true }
      : { ok: false, invalidLink: true, error: "Ugyldig eller utløpt tilbakestillingslenke." };
  }
  let res: Response;
  try {
    res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token, new_password: newPassword }),
    });
  } catch {
    return { ok: false, invalidLink: false, error: "Får ikke kontakt med innloggingen. Sjekk nettet og prøv igjen." };
  }
  if (res.ok) return { ok: true };
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (res.status === 429) return { ok: false, invalidLink: false, error: "For mange forsøk. Vent en time og prøv igjen." };
  // Field validation (too short a password) comes as {new_password: [...]}; a dead link as {detail}.
  const fieldError = Array.isArray(data.new_password) ? String(data.new_password[0]) : "";
  if (fieldError) return { ok: false, invalidLink: false, error: fieldError };
  const detail = typeof data.detail === "string" ? data.detail : "";
  if (res.status === 400) return { ok: false, invalidLink: true, error: detail || "Ugyldig eller utløpt tilbakestillingslenke." };
  return { ok: false, invalidLink: false, error: "Noe gikk galt. Prøv igjen." };
}
