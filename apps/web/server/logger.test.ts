import { describeError, type LogFields } from '@repo/core';
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

describe('LogFields', () => {
  /**
   * A compile-time check, run by `tsc` over this file: each directive fails the
   * typecheck gate if the line under it ever starts compiling.
   */
  it('takes an error only as describeError describes it', () => {
    const raw = Object.assign(new Error('Failed query: insert into "entries"\nparams: Secret memo'), {
      params: ['Secret memo'],
    });
    const caught: unknown = raw;

    const refused: readonly LogFields[] = [
      // @ts-expect-error -- an Error looks like a description, and is not one
      { event: 'raw', error: raw },
      // @ts-expect-error -- a caught value is unknown
      { event: 'caught', error: caught },
      // @ts-expect-error -- any other object could carry a row
      { event: 'object', params: { memo: 'Secret memo' } },
    ];
    const accepted: LogFields = { event: 'described', error: describeError(raw), attempt: 1 };

    expect(refused).toHaveLength(3);
    expect(accepted['error']).toEqual({
      name: 'Error',
      message: 'A query failed; its text and parameters are not logged.',
    });
  });
});
