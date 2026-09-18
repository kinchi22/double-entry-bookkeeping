import { type Brand } from './brand';
import { uuidV7Schema } from './id';

/**
 * The authentication slice. ADR-0021.
 *
 * Only a User's id crosses a boundary: a Session token travels in a cookie the
 * browser never reads, and the rest of a User is core's.
 */

export type UserId = Brand<string, 'UserId'>;
export const userIdSchema = uuidV7Schema.transform((id): UserId => id as UserId);
