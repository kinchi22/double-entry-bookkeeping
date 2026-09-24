'use client';

import { createPostgresHealthProbe } from '@repo/core/server';

export default function ServerOnlyProbePage(): React.ReactNode {
  return <div>{String(createPostgresHealthProbe)}</div>;
}
