import { type Logger } from '@repo/core';
import pino, { type DestinationStream } from 'pino';

/**
 * The composition root's logger: pino, one JSON object per line. ADR-0018.
 *
 * Adapters decide what a line carries, through `describeError`; this decides
 * only its shape. The level is a label rather than pino's number, the time is
 * ISO 8601, and pino's `pid` and `hostname` are left out, because the platform
 * already stamps every line with where it ran.
 *
 * The destination is an argument so a test can read what was written. The app
 * passes `stderr()`, from `container.ts` and from `instrumentation.ts`.
 *
 * Like `env.ts`, this file does not import `server-only`, so it stays testable.
 */
/**
 * Standard error, written synchronously. A buffered write can be lost when a
 * serverless function is frozen after its response.
 */
export function stderr(): DestinationStream {
  return pino.destination({ dest: 2, sync: true });
}

export function createLogger(destination: DestinationStream): Logger {
  const logger = pino(
    {
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    destination,
  );

  return {
    error: (fields, message) => {
      logger.error(fields, message);
    },
  };
}
