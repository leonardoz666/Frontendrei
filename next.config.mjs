/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure we don't have strict mode issues
  reactStrictMode: true,
  // Disable powered by header
  poweredByHeader: false,
  
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
