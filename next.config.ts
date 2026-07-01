import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack: faster dev server, fewer filesystem reads than webpack
  turbopack: {},
};

export default nextConfig;
