import {
  domainError,
  err,
  ok,
  type DomainError,
  type Money,
  type Result,
} from '@repo/contracts';

/**
 * Construction and arithmetic for amounts of money.
 *
 * Everything here is pure and total: no clock, no IO, one output per input.
 * Operations that can leave the representable range return a Result rather than
 * an approximate answer, because an amount that silently lost precision is a
 * ledger that silently stops balancing.
 *
 * There is no `subtractMoney`. `addMoney(a, negateMoney(b))` is the same
 * operation with one fewer function to keep correct.
 */

/** The additive identity. Safe to state as a constant: zero is always valid. */
export const MONEY_ZERO = 0 as Money;

/**
 * Builds an amount from a raw count of minor units.
 *
 * Outside the safe integer range `number` starts rounding, so 2^53 and 2^53 + 1
 * become the same value. An amount that cannot be distinguished from its
 * neighbour is not an amount, so the range is a rule rather than a warning.
 */
export function money(minorUnits: number): Result<Money, DomainError> {
  if (!Number.isSafeInteger(minorUnits)) {
    return err(
      domainError(
        'INVALID_INPUT',
        'An amount must be a whole number of minor units within the safe integer range.',
      ),
    );
  }
  return ok(minorUnits as Money);
}

/** The underlying count. The only sanctioned way back to a plain number. */
export function moneyToMinorUnits(amount: Money): number {
  return amount;
}

/**
 * Negation never leaves the safe range, so it cannot fail.
 *
 * Negating zero is special-cased because `-0` is a distinct value that compares
 * equal to `0` under `===` but not under `Object.is`, which is what `toEqual`
 * and most snapshot comparisons use. An amount must have exactly one
 * representation, or two ledgers that hold the same balance can fail to match.
 */
export function negateMoney(amount: Money): Money {
  // Unwrapped first: negating the branded type directly is rejected by
  // no-unsafe-unary-minus, which is the rule noticing that a brand is not a
  // number as far as arithmetic is concerned.
  const negated = -moneyToMinorUnits(amount);
  return (negated === 0 ? MONEY_ZERO : negated) as Money;
}

export function isZeroMoney(amount: Money): boolean {
  return amount === MONEY_ZERO;
}

/**
 * Adds two amounts, refusing a sum that would leave the safe integer range.
 *
 * The check is on the result rather than on the operands: two individually
 * valid amounts can still add up to something unrepresentable.
 */
export function addMoney(left: Money, right: Money): Result<Money, DomainError> {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    return err(
      domainError('INVALID_INPUT', 'The sum of these amounts is outside the safe integer range.'),
    );
  }
  return ok(total as Money);
}

/**
 * Adds a list of amounts. An empty list sums to zero, which is what makes this
 * usable for "do the entries of this transaction balance" without the caller
 * special-casing the empty case.
 */
export function sumMoney(amounts: readonly Money[]): Result<Money, DomainError> {
  let total: Money = MONEY_ZERO;
  for (const amount of amounts) {
    const next = addMoney(total, amount);
    if (!next.ok) {
      return next;
    }
    total = next.value;
  }
  return ok(total);
}
