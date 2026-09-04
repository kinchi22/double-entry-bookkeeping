import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages are published as TypeScript source, so the app compiles
  // them itself. This is what makes the `exports` field the real boundary: a
  // deep import into a package fails to resolve instead of quietly working.
  transpilePackages: ['@repo/contracts', '@repo/core', '@repo/ui'],
  // The server-only gate check builds a deliberately broken app. Letting it
  // write somewhere else keeps it from leaving .next in a half-built state that
  // the next `next start` would trip over.
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
  typescript: {
    // Type errors are the `typecheck` gate's job, and it runs before `build`.
    // Never set this to true.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
