import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Standalone output traces exactly the files the server needs and copies them
   * next to the build, so the runtime image carries no node_modules tree and no
   * source. It is what makes the deployed image ~200 MB instead of ~1.5 GB.
   */
  output: "standalone",
};

export default nextConfig;
