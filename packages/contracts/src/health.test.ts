import { describe, expect, it } from 'vitest';
import { healthStatusSchema, toHealthStatus } from './health';

const CHECKED_AT = new Date('2026-01-01T00:00:00.000Z');

describe('toHealthStatus', () => {
  it('renders the instant as an ISO 8601 string in UTC', () => {
    const status = toHealthStatus({
      status: 'healthy',
      components: [{ name: 'postgres', reachable: true }],
      checkedAt: CHECKED_AT,
    });

    expect(status.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('renders an instant taken in another offset in UTC too', () => {
    const status = toHealthStatus({
      status: 'healthy',
      components: [{ name: 'postgres', reachable: true }],
      checkedAt: new Date('2026-01-01T09:00:00+09:00'),
    });

    expect(status.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('produces a value the contract itself accepts', () => {
    const status = toHealthStatus({
      status: 'degraded',
      components: [{ name: 'postgres', reachable: false }],
      checkedAt: CHECKED_AT,
    });

    expect(healthStatusSchema.parse(status)).toEqual(status);
  });

  it('keeps the state and every component, in order', () => {
    const status = toHealthStatus({
      status: 'degraded',
      components: [
        { name: 'postgres', reachable: true },
        { name: 'cache', reachable: false },
      ],
      checkedAt: CHECKED_AT,
    });

    expect(status.status).toBe('degraded');
    expect(status.components).toEqual([
      { name: 'postgres', reachable: true },
      { name: 'cache', reachable: false },
    ]);
  });

  it('copies the component list rather than handing back the array it was given', () => {
    const components = [{ name: 'postgres', reachable: true }];

    const status = toHealthStatus({ status: 'healthy', components, checkedAt: CHECKED_AT });
    status.components.push({ name: 'smuggled', reachable: false });

    expect(components).toEqual([{ name: 'postgres', reachable: true }]);
  });

  it('serialises a report with no components, because emptiness is for the domain to reject', () => {
    const status = toHealthStatus({ status: 'degraded', components: [], checkedAt: CHECKED_AT });

    expect(status.components).toEqual([]);
    expect(healthStatusSchema.parse(status)).toEqual(status);
  });
});
