import type { NextConfig } from "next";

/*
 * Local development against staging: `NEXT_PUBLIC_DATA_SOURCE=api npm run dev`
 * proxies /api/* to the staging gateway, so the browser stays same-origin and no
 * CORS change is needed anywhere. Dev only — in the built image the ERP's own
 * gateway block (erp.conf) routes /api/, and a rewrite here would bypass it.
 */
const DEV_API_PROXY = process.env.DEV_API_PROXY ?? "https://api-test.absystem.no";
const DEV_API = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DATA_SOURCE === "api";

const nextConfig: NextConfig = {
  /*
   * Standalone output traces exactly the files the server needs and copies them
   * next to the build, so the runtime image carries no node_modules tree and no
   * source. It is what makes the deployed image ~200 MB instead of ~1.5 GB.
   */
  output: "standalone",
  /*
   * Dev proxy only: Next would 308 `/api/recruitment/leads/` → `…/leads` BEFORE the
   * rewrite, Django then 301s back to `/leads/` without the /api/recruitment prefix, and
   * every list at an app root breaks locally (found by A2). Kept off in the built image,
   * where the gateway routes /api/ before Next and page URLs keep their normal redirect.
   */
  skipTrailingSlashRedirect: DEV_API,
  async rewrites() {
    if (!DEV_API) return [];
    // `:path*` drops a trailing slash, and Django's slash redirect then loses the
    // /api/<svc>/ prefix — so slash-terminated paths get their own rule, first.
    return [
      { source: "/api/:path*/", destination: `${DEV_API_PROXY}/api/:path*/` },
      { source: "/api/:path*", destination: `${DEV_API_PROXY}/api/:path*` },
    ];
  },
};

export default nextConfig;
