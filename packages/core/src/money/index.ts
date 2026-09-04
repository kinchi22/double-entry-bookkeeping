/**
 * Public surface of the money vocabulary.
 *
 * Not a feature in the product sense: it is the shared kernel every feature that
 * touches an amount depends on. It holds domain code only, because an amount has
 * no ports, no adapters, and nothing to orchestrate.
 */
export {
  MONEY_ZERO,
  addMoney,
  isZeroMoney,
  money,
  moneyToMinorUnits,
  negateMoney,
  sumMoney,
} from './domain/money';
