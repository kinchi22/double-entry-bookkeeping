import { type Logger } from '@repo/core';
import pino, { type DestinationStream } from 'pino';

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
