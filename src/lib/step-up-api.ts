/**
 * The four Auth calls of the IFK-04 step-up (see step-up.tsx). Same origin, through the gateway.
 */
export const STEP_UP_PLATFORM = "erp-2fa";

// ---- the four Auth calls the dialog makes (same origin, through the gateway) ----

async function json(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type StepUpLogin =
  | { kind: "otp"; preAuthToken: string }
  | { kind: "enroll"; enrollToken: string }
  | { kind: "error"; message: string };

export async function stepUpLogin(username: string, password: string): Promise<StepUpLogin> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, platform: STEP_UP_PLATFORM }),
  });
  const body = await json(res);
  if (res.status === 401) return { kind: "error", message: "Feil passord." };
  if (res.status === 403) {
    return { kind: "error", message: "Kontoen din kan ikke bruke tofaktor i ERP. Kontakt Lars eller Joseph." };
  }
  if (res.status === 429) return { kind: "error", message: "For mange forsøk. Vent litt og prøv igjen." };
  if (!res.ok) return { kind: "error", message: "Kunne ikke bekrefte. Prøv igjen." };
  if (body.two_factor_required && typeof body.pre_auth_token === "string") {
    return { kind: "otp", preAuthToken: body.pre_auth_token };
  }
  if (body.two_factor_enrollment_required && typeof body.access === "string") {
    return { kind: "enroll", enrollToken: body.access };
  }
  return { kind: "error", message: "Uventet svar fra innloggingen. Prøv igjen." };
}

export async function stepUpVerify(preAuthToken: string, code: string): Promise<{ token: string } | { error: string }> {
  const trimmed = code.replace(/\s+/g, "");
  const res = await fetch("/api/auth/2fa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${preAuthToken}` },
    body: JSON.stringify({ method: /^\d{6}$/.test(trimmed) ? "totp" : "backup_code", code: trimmed }),
  });
  const body = await json(res);
  if (res.ok && typeof body.access === "string") return { token: body.access };
  if (res.status === 429) return { error: "For mange forsøk. Vent litt og prøv igjen." };
  return { error: "Feil kode. Prøv igjen." };
}

export async function enrollStart(enrollToken: string): Promise<{ qr: string; secret: string } | { error: string }> {
  const res = await fetch("/api/auth/2fa/enroll/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${enrollToken}` },
  });
  const body = await json(res);
  if (res.ok && typeof body.qr_data_url === "string" && typeof body.secret === "string") {
    return { qr: body.qr_data_url, secret: body.secret };
  }
  return { error: "Kunne ikke starte oppsett av tofaktor. Prøv igjen." };
}

export async function enrollConfirm(
  enrollToken: string,
  code: string,
): Promise<{ token: string; backupCodes: string[] } | { error: string }> {
  const res = await fetch("/api/auth/2fa/enroll/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${enrollToken}` },
    body: JSON.stringify({ code: code.replace(/\s+/g, "") }),
  });
  const body = await json(res);
  if (res.ok && typeof body.access === "string") {
    return { token: body.access, backupCodes: Array.isArray(body.backup_codes) ? (body.backup_codes as string[]) : [] };
  }
  return { error: "Feil kode. Sjekk at klokken på telefonen er riktig, og prøv igjen." };
}
