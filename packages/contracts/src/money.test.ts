import { describe, expect, it } from 'vitest';
import { moneySchema } from './money';

/**
 * The transport rule for an amount, which is narrower than what JSON can carry:
 * a whole number of minor units inside the safe integer range. The same
 * invariant is owned again by the constructor in `@repo/core/money`, for values
 * that never crossed a transport boundary.
 */
describe('moneySchema', () => {
  it('accepts a whole number of minor units and hands back the amount', () => {
    expect(moneySchema.parse(1500)).toBe(1500);
  });

  it('accepts zero and a negative amount, because a credit is an amount too', () => {
    expect(moneySchema.parse(0)).toBe(0);
    expect(moneySchema.parse(-1500)).toBe(-1500);
  });

  it('rejects a fractional amount rather than rounding it', () => {
    expect(moneySchema.safeParse(15.5).success).toBe(false);
  });

  it('rejects a value outside the safe integer range, where neighbours stop being distinct', () => {
    expect(moneySchema.safeParse(Number.MAX_SAFE_INTEGER + 2).success).toBe(false);
  });

  it('rejects a numeric string, so the wire form is a number and only a number', () => {
    expect(moneySchema.safeParse('1500').success).toBe(false);
  });
});
