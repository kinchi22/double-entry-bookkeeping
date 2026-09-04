/**
 * Drizzle schema.
 *
 * Empty on purpose. Phase 0 builds the pipeline, not the product, and inventing
 * tables before the first real acceptance criterion exists is how schemas end up
 * shaped around guesses. Phase 1 adds the first table alongside the migration
 * that creates it.
 *
 * Two standing rules for anything added here:
 *   - timestamps are `timestamptz`, stored in UTC, converted only at display
 *   - money is stored as an integer count of minor units, never a float
 */
export const schema = {} as const;

export type Schema = typeof schema;
