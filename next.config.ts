import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  /* Tell Next.js NOT to bundle these — they use native Node.js modules
     and must be loaded directly from node_modules at runtime. */
  serverExternalPackages: ["@react-pdf/renderer"],
  images: { remotePatterns: [] },
};

export default nextConfig;
