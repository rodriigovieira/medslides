import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Backdrops are served from Convex file storage.
    remotePatterns: [{ protocol: "https", hostname: "*.convex.cloud" }],
  },
};

export default nextConfig;
