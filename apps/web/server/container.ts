import 'server-only';
import { createGetHealth, type GetHealth } from '@repo/core';
import { createPostgresHealthProbe } from '@repo/core/server';
import { parseEnv } from './env';

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
};

export type ContainerEnvironment = {
  readonly databaseUrl: string;
};

export function createContainer({ databaseUrl }: ContainerEnvironment): Container {
  const postgres = createPostgresHealthProbe(databaseUrl);

  return {
    getHealth: createGetHealth({
      probes: [postgres],
      now: () => new Date(),
    }),
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
