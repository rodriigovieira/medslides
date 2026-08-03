import type { NextConfig } from "next";

// GitHub Pages serves the site from https://<user>.github.io/<repo>/, so the
// build needs a basePath. Set BASE_PATH="" when deploying to a custom domain
// or to the root of a user/org Pages site.
const basePath = process.env.BASE_PATH ?? "/medslides";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
