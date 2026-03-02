import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
    ],
  },
  // Ensure server-side packages aren't bundled for client
  serverExternalPackages: ['ioredis'],
};

export default nextConfig;
