import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable PWA for now to debug routing issues
  // turbopack: {}, // Removing experimental turbopack config
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/:path*`,
      },
    ]
  },
};

export default nextConfig;
