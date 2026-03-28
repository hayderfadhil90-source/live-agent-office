import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["phaser"],
  },
};

export default nextConfig;
