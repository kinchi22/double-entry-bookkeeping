/**
 * What of a thrown error may be written to a log: its name, its code, and its
 * message. Pure, so the rule is measured rather than trusted. ADR-0018.
 *
 * A driver error is usually wrapped. drizzle throws a `DrizzleQueryError` whose
 * own message quotes the query and its parameters -- a memo, an amount -- and
 * whose `cause` is the pg error that says what went wrong. So the description
 * is of the innermost cause, and a pg error's `detail`, which can quote a row,
 * is never read at all.
 */

export type ErrorDescription = {
  readonly name: string;
  /** A SQLSTATE such as `42P01`, or a system code such as `ECONNREFUSED`. */
  readonly code?: string;
  readonly message: string;
};

/** Far deeper than any real chain, and a stop for a cycle. */
const MAX_DEPTH = 8;

/**
 * The error one wrapper holds. A failed connection to a host with several
 * addresses is an `AggregateError`, whose first error names the cause. A cause
 * that is not an Error explains nothing, so the wrapper is kept instead.
 */
function unwrap(error: unknown): Error | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  if (error.cause instanceof Error) {
    return error.cause;
  }
  if (error instanceof AggregateError) {
    const first: unknown = error.errors[0];
    return first instanceof Error ? first : undefined;
  }
  return undefined;
}

/** The error a chain of wrappers ends at. */
function innermost(thrown: unknown): unknown {
  let current = thrown;
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const inner = unwrap(current);
    if (inner === undefined) {
      return current;
    }
    current = inner;
  }
  return current;
}

/** Read without narrowing, so only a string code survives. */
function codeOf(error: Error): string | undefined {
  const code: unknown = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

export function describeError(thrown: unknown): ErrorDescription {
  const error = innermost(thrown);
  if (!(error instanceof Error)) {
    return { name: typeof error, message: 'A value that is not an Error was thrown.' };
  }

  // A query error with nothing inside it still quotes its parameters.
  const message =
    'params' in error ? 'A query failed; its text and parameters are not logged.' : error.message;
  const code = codeOf(error);
  return code === undefined
    ? { name: error.name, message }
    : { name: error.name, code, message };
}
