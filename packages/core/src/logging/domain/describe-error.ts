import { type Brand } from '@repo/contracts';

type Described = {
  readonly name: string;
  readonly code?: string;
  readonly message: string;
};

export type ErrorDescription = Brand<Described, 'ErrorDescription'>;

const describe = (fields: Described): ErrorDescription => fields as ErrorDescription;

const MAX_DEPTH = 8;

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

function codeOf(error: Error): string | undefined {
  const code: unknown = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

export function describeError(thrown: unknown): ErrorDescription {
  const error = innermost(thrown);
  if (!(error instanceof Error)) {
    return describe({ name: typeof error, message: 'A value that is not an Error was thrown.' });
  }

  const message =
    'params' in error ? 'A query failed; its text and parameters are not logged.' : error.message;
  const code = codeOf(error);
  return describe(
    code === undefined ? { name: error.name, message } : { name: error.name, code, message },
  );
}
