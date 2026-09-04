import { defineConfig } from 'drizzle-kit';

/**
 * Portable Postgres only. No vendor-specific driver or API, so the same
 * migrations run against Neon, RDS, or a local container unchanged.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
