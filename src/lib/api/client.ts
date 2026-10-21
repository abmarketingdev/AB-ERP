import { z } from "zod";
import { IS_MOCK } from "@/lib/data-source";
import { authorizedFetch } from "@/lib/auth-tokens";

/**
 * The one boundary. Everything crossing the network goes through here.
 *
 * A component never calls fetch and never knows a URL. When the real gateway
 * arrives the only change is NEXT_PUBLIC_API_BASE plus whatever Zod complains
 * about — if fixing that requires editing a component, the boundary leaked.
 */

const MOCKING = IS_MOCK;

/**
 * While mocking is on, the base URL is forced empty so every request is
 * same-origin and therefore interceptable by the service worker.
 *
 * This is a guard, not a convenience: there is no backend yet, and a stray
 * NEXT_PUBLIC_API_BASE would send real requests to a real host carrying a demo
 * token. Set NEXT_PUBLIC_DATA_SOURCE=api to opt out deliberately.
 */
const CONFIGURED_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const BASE = MOCKING ? "" : CONFIGURED_BASE;

if (MOCKING && CONFIGURED_BASE) {
  console.warn(
    `[api] NEXT_PUBLIC_API_BASE is set to "${CONFIGURED_BASE}" but mocking is enabled, ` +
      "so it is being ignored. Set NEXT_PUBLIC_DATA_SOURCE=api to call a real gateway.",
  );
}

/**
 * Path prefixes match the eventual gateway so nothing renames later.
 * Note /api/dashboard/ keeps its prefix — the existing analytics service does
 * not strip it, while the others do.
 */
export const API = {
  auth: "/api/auth",
  maps: "/api/maps",
  hr: "/api/hr",
  qc: "/api/qc",
  dashboard: "/api/dashboard",
  learning: "/api/learning",
  customer: "/api/customer",
  /** recruitment-service (SRS «Rekruttering og onboarding»); the gateway strips the prefix. */
  recruitment: "/api/recruitment",
} as const;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API ${status}`);
    this.name = "ApiError";
  }
}

/** Thrown when the server answered but the shape was not what we contracted for. */
export class ApiParseError extends Error {
  constructor(
    public path: string,
    public issues: z.ZodIssue[],
  ) {
    super(`Response from ${path} did not match its schema`);
    this.name = "ApiParseError";
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: Params) {
  const url = new URL(
    BASE + path,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  // Carry the demo scenario through to the mock layer so a whole screen can be
  // switched between "healthy week", "several follow-ups" and "failed import".
  if (typeof window !== "undefined") {
    const scenario = new URLSearchParams(window.location.search).get("scenario");
    if (scenario) url.searchParams.set("scenario", scenario);
  }
  return url.toString();
}

/**
 * Two independent credentials, never merged.
 *
 * The staff app and the customer portal are separate products that happen to
 * share a repo for the demo. They get separate headers so neither can ever
 * authorise the other's requests — a staff token must not be able to fetch a
 * customer report, and a customer token must not reach a staff endpoint
 * (FR-C-02). During an admin preview both are present, and the endpoint each
 * request lands on decides which one it honours.
 */
function authHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (typeof window === "undefined") return headers;

  const token = window.localStorage.getItem("ab-erp-token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const customer = customerToken();
  if (customer) headers["X-Customer-Token"] = customer;
  return headers;
}

/**
 * The customer's own token, or the synthetic one an admin preview stands in
 * with. The preview path mints it here rather than writing a real token to
 * storage, so ending the preview cannot leave a working customer session behind.
 */
function customerToken(): string | null {
  const stored = window.localStorage.getItem("ab-erp-customer-token");
  if (stored) return stored;
  try {
    const raw = window.localStorage.getItem("ab-erp-preview");
    if (!raw) return null;
    const preview = JSON.parse(raw) as { type?: string; key?: string };
    if (preview.type !== "customer" || !preview.key) return null;
    return btoa(JSON.stringify({ email: preview.key, verified: true }));
  } catch {
    return null;
  }
}

async function safeBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function parseOr<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Loud at the boundary, never a silent undefined three components deep.
    console.error(`[api] schema mismatch on ${path}`, result.error.issues);
    throw new ApiParseError(path, result.error.issues);
  }
  return result.data;
}

export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  params?: Params,
): Promise<T> {
  const res = await authorizedFetch(buildUrl(path, params), {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(res.status, await safeBody(res));
  return parseOr(schema, await res.json(), path);
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  params?: Params,
): Promise<T> {
  const res = await authorizedFetch(buildUrl(path, params), {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await safeBody(res));
  return parseOr(schema, await res.json(), path);
}

/**
 * multipart/form-data upload (attachments KAND-06, Recman import, onboarding photo).
 *
 * Same auth, refresh-and-replay and error mapping as apiSend, but NO Content-Type
 * header: the browser must set it itself so the multipart boundary is included —
 * a hand-set "multipart/form-data" without a boundary is unparseable server-side.
 * The FormData is reusable, so a replay after a token refresh sends it intact.
 */
export async function apiUpload<T>(
  path: string,
  schema: z.ZodType<T>,
  form: FormData,
  params?: Params,
): Promise<T> {
  const headers = new Headers(authHeaders());
  headers.delete("Content-Type");
  const res = await authorizedFetch(buildUrl(path, params), { method: "POST", headers, body: form });
  if (!res.ok) throw new ApiError(res.status, await safeBody(res));
  return parseOr(schema, await res.json(), path);
}

export const apiPost = <T>(path: string, schema: z.ZodType<T>, body?: unknown, params?: Params) =>
  apiSend("POST", path, schema, body, params);

export const apiPatch = <T>(path: string, schema: z.ZodType<T>, body?: unknown, params?: Params) =>
  apiSend("PATCH", path, schema, body, params);

/**
 * Maps a thrown error to Norwegian UI copy. Called at the component boundary —
 * never inside the client, so the client stays language-agnostic.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiParseError) {
    return "Dataene fra serveren hadde uventet format. Kontakt support.";
  }
  if (error instanceof ApiError) {
    /*
     * A 4xx is the server saying the *request* was wrong, and it usually knows
     * exactly why: which field, which team, which rule. Replacing that with
     * "noen felter mangler eller er ugyldige" throws away the only sentence
     * that would have let the user fix it. So a supplied message wins for 4xx.
     *
     * 5xx never does. A failure inside the server is not a sentence anybody
     * outside it should read, and stack-shaped text in a customer-facing banner
     * is how internals leak.
     */
    const supplied = serverMessage(error.body);
    if (supplied && error.status >= 400 && error.status < 500) return supplied;

    switch (error.status) {
      case 401:
        return "Du er ikke logget inn lenger. Logg inn på nytt.";
      case 403:
        return "Du har ikke tilgang til dette.";
      case 404:
        return "Fant ikke det du lette etter.";
      case 422:
        return "Noen felter mangler eller er ugyldige.";
      default:
        return error.status >= 500
          ? "Noe gikk galt hos oss. Prøv igjen."
          : "Forespørselen kunne ikke fullføres.";
    }
  }
  return "Kunne ikke hente data. Prøv igjen.";
}

/** A non-empty, sentence-shaped `message` from the response body, or null. */
function serverMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const message = (body as { message?: unknown }).message;
  if (typeof message !== "string") return null;
  const trimmed = message.trim();
  // Guard against a bare code or an id being rendered as user-facing copy.
  return trimmed.length >= 8 && /\s/.test(trimmed) ? trimmed : null;
}
