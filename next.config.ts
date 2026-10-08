import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      // Versioned SDK files never change: cache forever at the CDN and browser.
      { source: "/sdk/v:version/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
      // The unversioned alias tracks the latest release: short cache so updates roll out.
      { source: "/sdk/nexa.min.js", headers: [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};

export default nextConfig;
