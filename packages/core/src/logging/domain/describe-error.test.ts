import { describe, expect, it } from 'vitest';
import { describeError } from './describe-error';

/** A pg error as node-postgres builds one: a code, and a detail quoting the row. */
const pgError = (message: string, code: string): Error =>
  Object.assign(new Error(message), {
    name: 'DatabaseError',
    code,
    detail: 'Failing row contains (Office supplies for the secret project).',
  });

/** drizzle's wrapper: its message and its params quote what was written. */
const queryError = (cause?: Error): Error =>
  Object.assign(
    new Error('Failed query: insert into "entries" values ($1)\nparams: Secret memo', { cause }),
    { name: 'DrizzleQueryError', params: ['Secret memo'] },
  );

describe('describeError', () => {
  it('describes an error by its name and message', () => {
    // Strict, so a description without a code has no `code` key at all.
    expect(describeError(new TypeError('Cannot read properties of undefined'))).toStrictEqual({
      name: 'TypeError',
      message: 'Cannot read properties of undefined',
    });
  });

  it('keeps a string code, and nothing else a driver attached', () => {
    const described = describeError(pgError('relation "entries" does not exist', '42P01'));

    expect(described).toEqual({
      name: 'DatabaseError',
      code: '42P01',
      message: 'relation "entries" does not exist',
    });
  });

  it('drops a code that is not a string', () => {
    expect(describeError(Object.assign(new Error('odd'), { code: 42 }))).toStrictEqual({
      name: 'Error',
      message: 'odd',
    });
  });

  it('describes the pg error inside a query error, never the query or its params', () => {
    const described = describeError(queryError(pgError('invalid input syntax', '22P02')));

    expect(described).toEqual({ name: 'DatabaseError', code: '22P02', message: 'invalid input syntax' });
    expect(JSON.stringify(described)).not.toContain('Secret');
  });

  it('withholds the message of a query error that has no cause', () => {
    const described = describeError(queryError());

    expect(described).toEqual({
      name: 'DrizzleQueryError',
      message: 'A query failed; its text and parameters are not logged.',
    });
  });

  it('follows a chain of causes to its end', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    const chain = new Error('outer', { cause: new Error('middle', { cause: refused }) });

    expect(describeError(chain)).toEqual({
      name: 'Error',
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 10.0.0.1:5432',
    });
  });

  it('describes the first error of an aggregate, as a failed multi-address connection throws', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED ::1:5432'), {
      code: 'ECONNREFUSED',
    });
    const aggregate = new AggregateError([refused, new Error('second address')], '');

    expect(describeError(queryError(aggregate))).toEqual({
      name: 'Error',
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED ::1:5432',
    });
  });

  it('keeps an aggregate whose first entry is not an Error', () => {
    expect(describeError(new AggregateError(['refused'], 'all attempts failed'))).toEqual({
      name: 'AggregateError',
      message: 'all attempts failed',
    });
  });

  it('keeps a wrapper whose cause is not an Error', () => {
    expect(describeError(new Error('outer', { cause: 'Secret memo' }))).toEqual({
      name: 'Error',
      message: 'outer',
    });
  });

  it('stops on a cycle of causes, after a fixed number of steps', () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });
    first.cause = second;

    expect(describeError(first).message).toBe('first');
  });

  it.each([
    ['a string', 'Secret memo'],
    ['null', null],
    ['undefined', undefined],
  ])('describes %s that was thrown without quoting it', (_, thrown) => {
    const described = describeError(thrown);

    expect(described.message).toBe('A value that is not an Error was thrown.');
    expect(described.name).toBe(typeof thrown);
    expect(JSON.stringify(described)).not.toContain('Secret');
  });
});
