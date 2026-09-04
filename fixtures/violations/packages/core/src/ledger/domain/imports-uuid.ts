/**
 * VIOLATION: domain generates an id itself.
 *
 * Reading a random source makes the function non-deterministic, which quietly
 * empties the mutation gate: a mutant that changes the result cannot be
 * detected by a test that cannot predict the result either.
 *
 * Expected gate: no-restricted-imports.
 */
import { v7 as uuidv7 } from 'uuid';

export function newEntryId(): string {
  return uuidv7();
}
