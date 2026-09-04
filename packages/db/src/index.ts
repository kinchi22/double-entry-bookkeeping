/**
 * The single public surface of @repo/db.
 *
 * Only packages/core/src/*\/adapters may import this package. That rule is
 * enforced by eslint-plugin-boundaries and again by dependency-cruiser.
 */
export { createDatabase } from './client';
export type { Database } from './client';
export { schema } from './schema';
export type { Schema } from './schema';
