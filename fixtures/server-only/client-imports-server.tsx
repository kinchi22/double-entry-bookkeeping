'use client';

// VIOLATION: a client component reaching into the server-side entry point of
// @repo/core. Without the `server-only` marker this would bundle adapter code --
// and the database connection string it reads -- into the browser.
// Expected gate: build (next build).
import { createPostgresHealthProbe } from '@repo/core/server';

export default function ServerOnlyProbePage(): React.ReactNode {
  return <div>{String(createPostgresHealthProbe)}</div>;
}
