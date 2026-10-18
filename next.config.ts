import type { NextConfig } from "next";

// /play's 3D models are requested with a content hash (?v=..., from
// scripts/3d/hash-models.mjs), so they can be cached forever. Unhashed game media gets a week
// plus background revalidation; the manifests always revalidate so new hashes show up at once.
const IMMUTABLE = "public, max-age=31536000, immutable";
const WEEK = "public, max-age=604800, stale-while-revalidate=2592000";
const REVALIDATE = "public, max-age=0, must-revalidate";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/game3d/models/:file*.glb",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        source: "/game3d/models/:file*.json",
        headers: [{ key: "Cache-Control", value: REVALIDATE }],
      },
      {
        source: "/game3d/:dir(audio|portraits)/:file*",
        headers: [{ key: "Cache-Control", value: WEEK }],
      },
      {
        source: "/game/:path*",
        headers: [{ key: "Cache-Control", value: WEEK }],
      },
    ];
  },
};

export default nextConfig;
