import { describeError } from '@repo/core';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

/** Every line the logger wrote, parsed. */
function capture(): { lines: () => unknown[]; destination: { write: (line: string) => void } } {
  const written: string[] = [];
  return {
    lines: () => written.map((line) => JSON.parse(line) as unknown),
    destination: {
      write: (line) => {
        written.push(line);
      },
    },
  };
}

describe('createLogger', () => {
  it('writes one JSON object per line: level label, ISO time, the fields, the message', () => {
    const { lines, destination } = capture();
    const logger = createLogger(destination);

    logger.error(
      { event: 'entries.list_failed', error: describeError(new Error('connection refused')) },
      'The entries could not be read.',
    );

    expect(lines()).toEqual([
      {
        level: 'error',
        time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) as unknown,
        event: 'entries.list_failed',
        error: { name: 'Error', message: 'connection refused' },
        msg: 'The entries could not be read.',
      },
    ]);
  });

  it('writes each call as its own line', () => {
    const { lines, destination } = capture();
    const logger = createLogger(destination);

    logger.error({ event: 'first' }, 'one');
    logger.error({ event: 'second' }, 'two');

    expect(lines().map((line) => (line as { event: string }).event)).toEqual(['first', 'second']);
  });
});
