/** @type {import('next').NextConfig} */
const { default: withPWAInit, runtimeCaching } = require('@ducanh2912/next-pwa')

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheStartUrl: false,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: /\/api\//,
        handler: 'NetworkOnly',
        options: { cacheName: 'rei-api-network-only' },
      },
      ...runtimeCaching,
    ],
  },
})

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://backendrei.onrender.com'}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://backendrei.onrender.com'}/uploads/:path*`,
      },
    ]
  },
};

module.exports = withPWA(nextConfig);
