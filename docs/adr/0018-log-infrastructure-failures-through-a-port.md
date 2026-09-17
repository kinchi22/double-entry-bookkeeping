# ADR-0018: Log infrastructure failures through a port

**Status:** Accepted
**Date:** 2026-09-17

## Problem

Every Postgres adapter turns a database failure into a value: the health probe
into `false`, the entry repository into `DEPENDENCY_UNAVAILABLE`, with a generic
message because a message can reach an HTTP response. Nothing recorded what the
failure was.

That cost a diagnosis on the first merge of the entries milestone (#23). The
Production smoke run failed on `/entries` on all three attempts, and passed
unchanged when re-run on the same deployment. The page had errored, and nothing
recorded why: the health specs accept `unreachable`, and the repository's error
carries only its generic message.

Logging the thrown error as it is would leak. drizzle 0.45 wraps every query
failure in a `DrizzleQueryError` whose message quotes the query and its
parameters, a memo among them, and whose `params` field holds them again. A pg
error's `detail` can quote the row it refused. A generic serializer, pino's
included, copies all of it.

## Decision

- **A `Logger` port** in `packages/core/src/logging/ports`, with one method,
  `error(fields, message)`. `fields` carries an `event`, a stable dotted name
  such as `entries.list_failed`. Adapters take a logger as an argument, as they
  take a connection string.
- **`describeError`** in `packages/core/src/logging/domain` is the only way an
  error reaches a log line. It follows `cause`, and the first error of an
  `AggregateError`, to the innermost error, and keeps its name, a string `code`
  (a SQLSTATE, or a system code such as `ECONNREFUSED`) and its message. A
  query error with no cause keeps its name only. It is pure, so mutation testing
  measures it.
- **What is logged:** a failed read or write in the entry repository, a stored
  entry that breaks a rule, and a health probe that could not reach Postgres.
  Each is an `error`.
- **pino writes the lines**, in `apps/web` alone. The composition root builds
  one logger (`apps/web/server/logger.ts`) that writes one JSON object per line
  to stderr, synchronously: the level as a label, the time as ISO 8601, and no
  `pid` or `hostname`. Core never imports pino.
- `packages/core/src/logging` is the second shared module beside `money`, with a
  domain and a port and no adapter. Every adapter reports a failure the same
  way, and what may be logged is a rule worth measuring rather than repeating.

## Consequences

A failure now has an event name and a code to search for in the platform's
logs, and `health.probe_unreachable` says why the health panel is amber.

pino brings 13 package versions. None has an install script, and each bump is
a diff under `minimumReleaseAge`. Its transports run in worker threads, which do
not suit a serverless function, so none is used, and its error serializer is
bypassed rather than configured: an adapter logs a description, never an error.

A driver message can still name a host, a port or a user. That is acceptable in
a server log and is why the HTTP message stays generic. A message that quotes a
value from a column whose input syntax failed, such as a malformed date, can
still reach the log; the app parses those before they reach the driver.

Synchronous writes to stderr cost a system call per line. Only failures are
logged, so the cost lands on requests that are already failing.

The adapters' integration tests pass a recording logger and assert the event,
the code and, for a refused write, that the memo is absent. The pino logger has
a unit test of its own. Nothing tests that the platform keeps stderr.

Adding a logged event means naming it and choosing its fields in the adapter;
the port does not grow a method until a second level is needed.

## Rejected alternatives

**`console.error` in each adapter.** No dependency and the smallest change. It
cannot be tested without spying on `console`, and each adapter would decide for
itself what of an error to print.

**A console-backed implementation of the same port.** No dependency, the same
line. The owner preferred an established library for the format, levels and
child loggers as logging grows.

**pino inside core.** Next.js loads pino as an external package, so with pnpm's
strict layout the package that imports it must list it, and core would then
depend on a runtime library for what a port expresses in four lines.

**pino's own error serializer with a redaction list.** It copies every
enumerable field, so the list would have to name every field every driver might
add. Describing the error before logging it names the fields that are kept.

**The describer and the port in `packages/db`.** That package already knows
drizzle and pg, but mutation testing does not cover it, so the rule that keeps
parameters out of the log would be checked by integration tests alone.

**A describer and a port in each feature.** No shared module, and two copies of
the same rule to keep in step.
