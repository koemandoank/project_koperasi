import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.20.17', 'localhost'],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  /* config options here */
};

export default nextConfig;
