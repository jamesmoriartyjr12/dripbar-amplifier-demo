import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The demo is presented from the dev server; the floating indicator overlaps the footer.
  devIndicators: false,
};

export default nextConfig;
