/**
 * Where an adapter reports a failure it has turned into a result.
 *
 * Two implementations exist: the pino logger the composition root builds, and
 * the recording logger the integration tests read. An adapter passes an event
 * name and fields it chose, never a raw error: `describeError` decides what of
 * an error may be written. ADR-0018.
 */
export type LogFields = Readonly<Record<string, unknown>> & {
  /** A stable dotted name to search by, such as `entries.list_failed`. */
  readonly event: string;
};

export type Logger = {
  readonly error: (fields: LogFields, message: string) => void;
};
