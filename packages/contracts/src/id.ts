import { z } from 'zod';

/**
 * Identifiers are uuid v7.
 *
 * v7 puts a millisecond timestamp in the high bits, so ids sort by creation
 * time. That keeps a primary key index appending at the right-hand edge instead
 * of scattering writes across the whole B-tree the way v4 does, and it means a
 * list ordered by id is already in insertion order.
 *
 * Generation is an effect: it reads a clock and a random source, so it cannot
 * happen in `domain/`, where a function must have one output per input for the
 * mutation gate to mean anything. A use case receives a generator the same way
 * `createGetHealth` receives `now`, and the composition root supplies one built
 * on the `uuid` package. See the ID row in docs/ARCHITECTURE.md.
 *
 * Each entity brands its own id next to its own schema, which is two lines:
 *
 * ```ts
 * export type EntryId = Brand<string, 'EntryId'>;
 * export const entryIdSchema = uuidV7Schema.transform((id): EntryId => id as EntryId);
 * ```
 *
 * A generic factory would save one of those lines and cost the reader the
 * ability to see, in the feature's own contract file, exactly what an EntryId
 * is.
 */
export const uuidV7Schema = z.uuidv7();
