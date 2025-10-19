import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Netlify CI: do not fail build on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Netlify CI: do not fail build on TS type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
