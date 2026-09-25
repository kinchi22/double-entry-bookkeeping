import {
  domainError,
  err,
  ok,
  type DomainError,
  type Money,
  type Result,
} from '@repo/contracts';

export const MONEY_ZERO = 0 as Money;

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

export function moneyToMinorUnits(amount: Money): number {
  return amount;
}

export function negateMoney(amount: Money): Money {
  const negated = -moneyToMinorUnits(amount);
  return (negated === 0 ? MONEY_ZERO : negated) as Money;
}

export function isZeroMoney(amount: Money): boolean {
  return amount === MONEY_ZERO;
}

export function addMoney(left: Money, right: Money): Result<Money, DomainError> {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    return err(
      domainError('INVALID_INPUT', 'The sum of these amounts is outside the safe integer range.'),
    );
  }
  return ok(total as Money);
}

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
