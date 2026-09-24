import { describe, expect, it } from 'vitest';
import { isErr, isOk, type Money } from '@repo/contracts';
import {
  MONEY_ZERO,
  addMoney,
  isZeroMoney,
  money,
  moneyToMinorUnits,
  negateMoney,
  sumMoney,
} from './money';

const amount = (minorUnits: number): Money => {
  const result = money(minorUnits);
  expect(isOk(result), `test setup used an invalid amount: ${String(minorUnits)}`).toBe(true);
  return isOk(result) ? result.value : MONEY_ZERO;
};

describe('money', () => {
  it('accepts a whole number of minor units', () => {
    const result = money(1250);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(1250);
  });

  it('accepts a negative amount, because a credit is an amount too', () => {
    const result = money(-1250);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(-1250);
  });

  it('accepts zero', () => {
    const result = money(0);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(0);
  });

  it('accepts the largest exactly representable amount', () => {
    const result = money(Number.MAX_SAFE_INTEGER);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects one minor unit past the safe range, where numbers stop being exact', () => {
    const result = money(Number.MAX_SAFE_INTEGER + 1);

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(result.error.message).toContain('safe integer range');
  });

  it('rejects a fractional amount rather than rounding it', () => {
    const result = money(12.5);

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(result.error.message).toContain('whole number of minor units');
  });

  it('rejects NaN', () => {
    const result = money(Number.NaN);

    expect(isErr(result)).toBe(true);
  });

  it('rejects infinity', () => {
    const result = money(Number.POSITIVE_INFINITY);

    expect(isErr(result)).toBe(true);
  });
});

describe('MONEY_ZERO', () => {
  it('is zero minor units', () => {
    expect(moneyToMinorUnits(MONEY_ZERO)).toBe(0);
  });
});

describe('isZeroMoney', () => {
  it('is true for zero', () => {
    expect(isZeroMoney(MONEY_ZERO)).toBe(true);
  });

  it('is false for a positive amount', () => {
    expect(isZeroMoney(amount(1))).toBe(false);
  });

  it('is false for a negative amount', () => {
    expect(isZeroMoney(amount(-1))).toBe(false);
  });
});

describe('negateMoney', () => {
  it('turns a debit into a credit of the same size', () => {
    expect(moneyToMinorUnits(negateMoney(amount(1250)))).toBe(-1250);
  });

  it('turns a credit into a debit of the same size', () => {
    expect(moneyToMinorUnits(negateMoney(amount(-1250)))).toBe(1250);
  });

  it('leaves zero as positive zero rather than producing -0', () => {
    const negated = moneyToMinorUnits(negateMoney(MONEY_ZERO));

    expect(Object.is(negated, 0)).toBe(true);
    expect(Object.is(negated, -0)).toBe(false);
  });

  it('round-trips a non-zero amount through two negations', () => {
    expect(moneyToMinorUnits(negateMoney(negateMoney(amount(1250))))).toBe(1250);
  });
});

describe('addMoney', () => {
  it('adds two amounts', () => {
    const result = addMoney(amount(300), amount(45));

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(345);
  });

  it('adds a credit to a debit', () => {
    const result = addMoney(amount(300), amount(-500));

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(-200);
  });

  it('rejects a sum that leaves the safe range even though both operands are valid', () => {
    const result = addMoney(amount(Number.MAX_SAFE_INTEGER), amount(1));

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(result.error.message).toContain('outside the safe integer range');
  });
});

describe('sumMoney', () => {
  it('sums an empty list to zero, so a caller need not special-case it', () => {
    const result = sumMoney([]);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(0);
  });

  it('sums a single amount to itself', () => {
    const result = sumMoney([amount(1250)]);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(1250);
  });

  it('sums every amount in the list, not just the first or the last', () => {
    const result = sumMoney([amount(100), amount(20), amount(3)]);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(moneyToMinorUnits(result.value)).toBe(123);
  });

  it('sums a balanced set of entries to zero', () => {
    const result = sumMoney([amount(1250), amount(-750), amount(-500)]);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(isZeroMoney(result.value)).toBe(true);
  });

  it('reports the failure rather than the running total when the sum overflows', () => {
    const result = sumMoney([amount(Number.MAX_SAFE_INTEGER), amount(1), amount(1)]);

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(result.error.message).toContain('outside the safe integer range');
  });
});
