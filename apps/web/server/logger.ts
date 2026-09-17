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
 * The destination is an argument so a test can read what was written.
 * `container.ts` passes stderr, written synchronously: a buffered write can be
 * lost when a serverless function is frozen after its response.
 *
 * Like `env.ts`, this file does not import `server-only`, so it stays testable.
 */
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
