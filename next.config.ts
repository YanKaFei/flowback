import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  // All database access happens in Server Components / Route Handlers.
};

export default nextConfig;
