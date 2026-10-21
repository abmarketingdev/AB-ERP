import type { NextConfig } from "next";

/*
 * Local development against staging: `NEXT_PUBLIC_DATA_SOURCE=api npm run dev`
 * proxies /api/* to the staging gateway, so the browser stays same-origin and no
 * CORS change is needed anywhere. Dev only — in the built image the ERP's own
 * gateway block (erp.conf) routes /api/, and a rewrite here would bypass it.
 */
const DEV_API_PROXY = process.env.DEV_API_PROXY ?? "https://api-test.absystem.no";

const nextConfig: NextConfig = {
  /*
   * Standalone output traces exactly the files the server needs and copies them
   * next to the build, so the runtime image carries no node_modules tree and no
   * source. It is what makes the deployed image ~200 MB instead of ~1.5 GB.
   */
  output: "standalone",
  async rewrites() {
    if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_DATA_SOURCE !== "api") return [];
    return [{ source: "/api/:path*", destination: `${DEV_API_PROXY}/api/:path*` }];
  },
};

export default nextConfig;
