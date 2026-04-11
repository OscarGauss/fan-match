import type { NextConfig } from 'next';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3001').split(',');

const corsHeaders = (origin: string) => [
  { key: 'Access-Control-Allow-Origin', value: origin },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
];

const nextConfig: NextConfig = {
  async headers() {
    return ALLOWED_ORIGINS.map((origin) => ({
      source: '/api/:path*',
      headers: corsHeaders(origin),
    }));
  },
};

export default nextConfig;
