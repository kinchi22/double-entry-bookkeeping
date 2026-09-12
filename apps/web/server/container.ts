import 'server-only';
import { createGetHealth, type GetHealth } from '@repo/core';
import { createPostgresHealthProbe } from '@repo/core/server';

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
 */
export function getContainer(): Container {
  cached ??= createContainer({ databaseUrl: process.env['DATABASE_URL'] ?? '' });
  return cached;
}
