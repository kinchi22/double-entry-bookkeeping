import { type ErrorDescription } from '../domain/describe-error';

/**
 * Where an adapter reports a failure it has turned into a result.
 *
 * Two implementations exist: the pino logger the composition root builds, and
 * the recording logger the integration tests read. ADR-0018.
 */

/**
 * What a field may hold. A value, or an error as `describeError` described it:
 * never a raw error, a caught `unknown`, or any other object, whose enumerable
 * fields a JSON logger would write out -- drizzle's query parameters among
 * them. The compiler refuses the rest.
 */
export type LogValue = string | number | boolean | ErrorDescription;

export type LogFields = {
  /** A stable dotted name to search by, such as `entries.list_failed`. */
  readonly event: string;
  readonly [field: string]: LogValue | undefined;
};

export type Logger = {
  readonly error: (fields: LogFields, message: string) => void;
};
