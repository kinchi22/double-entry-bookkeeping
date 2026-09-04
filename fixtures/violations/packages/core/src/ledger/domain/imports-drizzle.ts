// VIOLATION: the ORM is an infrastructure detail. Domain must not import it.
// Expected gate: eslint, rule no-restricted-imports.
import { sql } from 'drizzle-orm';

export const probe = sql;
