import 'server-only';
import { entryIdSchema } from '@repo/contracts';
import {
  createGetHealth,
  createListEntries,
  createPostEntry,
  type GetHealth,
  type ListEntries,
  type PostEntry,
} from '@repo/core';
import { createPostgresEntryRepository, createPostgresHealthProbe } from '@repo/core/server';
import { v7 as uuidv7 } from 'uuid';
import { type Env, parseEnv } from './env';

/**
 * DI composition root.
 *
 * This is the only place in the repo allowed to choose a concrete
 * implementation. It is not exempt from anything: it used to be excused from
 * the dynamic-import ban because a person read it, and ADR-0002 reserved human
 * review for the specs and the applied migrations instead.
 *
 * Everything below this line is wiring. No business rules belong here.
 */
export type Container = {
  readonly getHealth: GetHealth;
  readonly postEntry: PostEntry;
  readonly listEntries: ListEntries;
};

export function createContainer({ databaseUrl }: Env): Container {
  const postgres = createPostgresHealthProbe(databaseUrl);
  const entries = createPostgresEntryRepository(databaseUrl);

  return {
    getHealth: createGetHealth({
      probes: [postgres],
      now: () => new Date(),
    }),
    postEntry: createPostEntry({
      entries,
      // Parsing brands the id, and would fail loudly if the generator ever
      // stopped producing v7.
      newEntryId: () => entryIdSchema.parse(uuidv7()),
      now: () => new Date(),
    }),
    listEntries: createListEntries({ entries }),
  };
}

let cached: Container | undefined;

/**
 * Reading configuration from the environment happens here and nowhere else.
 * Core receives configuration as arguments, which is what keeps it testable and
 * portable off Vercel.
 *
 * `parseEnv` is called here rather than at module scope on purpose. This module
 * is loaded while `next build` collects page data for
 * `apps/web/app/api/trpc/[trpc]/route.ts`, and that build runs in CI with no
 * database URL; a throw during import would fail it. Called from inside the
 * function, validation happens on the first request instead. ADR-0005.
 */
export function getContainer(): Container {
  cached ??= createContainer(parseEnv(process.env));
  return cached;
}
