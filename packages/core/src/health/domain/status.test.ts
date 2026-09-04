import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@repo/contracts';
import { evaluateHealth } from './status';

const CHECKED_AT = new Date('2026-01-01T00:00:00.000Z');

describe('evaluateHealth', () => {
  it('reports healthy when every component is reachable', () => {
    const result = evaluateHealth(
      [
        { name: 'postgres', reachable: true },
        { name: 'cache', reachable: true },
      ],
      CHECKED_AT,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('healthy');
    expect(result.value.components).toHaveLength(2);
    expect(result.value.checkedAt).toEqual(CHECKED_AT);
  });

  it('reports degraded when a single component is unreachable', () => {
    const result = evaluateHealth(
      [
        { name: 'postgres', reachable: true },
        { name: 'cache', reachable: false },
      ],
      CHECKED_AT,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('degraded');
  });

  it('reports degraded when every component is unreachable', () => {
    const result = evaluateHealth([{ name: 'postgres', reachable: false }], CHECKED_AT);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('degraded');
  });

  it('rejects an empty component list rather than claiming health', () => {
    const result = evaluateHealth([], CHECKED_AT);

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a component whose name is blank', () => {
    const result = evaluateHealth(
      [
        { name: 'postgres', reachable: true },
        { name: '   ', reachable: true },
      ],
      CHECKED_AT,
    );

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('preserves component order and names in the report', () => {
    const result = evaluateHealth(
      [
        { name: 'postgres', reachable: true },
        { name: 'cache', reachable: false },
      ],
      CHECKED_AT,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.components).toEqual([
      { name: 'postgres', reachable: true },
      { name: 'cache', reachable: false },
    ]);
  });
});
