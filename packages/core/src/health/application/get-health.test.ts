import { describe, expect, it } from 'vitest';
import { isOk } from '@repo/contracts';
import { createGetHealth } from './get-health';
import { type HealthProbe } from '../ports/health-probe';

/**
 * A stub, not a mock: it answers, and the assertions are about what the use case
 * produced, never about which methods were called on it.
 */
const probe = (name: string, reachable: boolean): HealthProbe => ({
  name,
  check: () => Promise.resolve(reachable),
});

const CHECKED_AT = new Date('2026-01-01T00:00:00.000Z');

describe('createGetHealth', () => {
  it('aggregates every probe into a single status', async () => {
    const getHealth = createGetHealth({
      probes: [probe('postgres', true), probe('cache', true)],
      now: () => CHECKED_AT,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('healthy');
    expect(result.value.components.map((component) => component.name)).toEqual([
      'postgres',
      'cache',
    ]);
  });

  it('degrades the whole status when one probe fails', async () => {
    const getHealth = createGetHealth({
      probes: [probe('postgres', true), probe('cache', false)],
      now: () => CHECKED_AT,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('degraded');
  });

  it('stamps the result with the injected clock', async () => {
    const getHealth = createGetHealth({
      probes: [probe('postgres', true)],
      now: () => CHECKED_AT,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.checkedAt).toEqual(CHECKED_AT);
  });
});
