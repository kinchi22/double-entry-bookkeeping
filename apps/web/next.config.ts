import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/contracts', '@repo/core', '@repo/ui'],
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
