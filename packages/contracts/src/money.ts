import { z } from 'zod';
import { type Brand } from './brand';

/**
 * An amount of money as an integer count of minor units.
 *
 * Floating point cannot represent a tenth exactly, so a ledger built on `number`
 * arithmetic drifts and then fails to balance by amounts nobody can explain.
 * Minor units make every representable amount exact.
 *
 * Every amount is scale 0: one minor unit is one whole unit, there are no
 * decimal places, and nothing here carries a currency symbol -- grouping is
 * applied when an amount is displayed. If a decimal currency ever appears, a
 * per-book scale is the additive path, and existing values are already scale 0.
 *
 * The brand is what stops a bare `number` being passed where an amount belongs.
 * Construction and arithmetic live in `@repo/core/money`, because both can fail
 * and failure in this project is a returned value rather than an exception.
 */
export type Money = Brand<number, 'Money'>;

/**
 * The wire form of an amount.
 *
 * `z.int()` already rejects non-integers and anything outside the safe integer
 * range, so this schema states the transport rule and nothing else. The domain
 * constructor in `@repo/core/money` owns the same invariant for values that
 * never crossed a transport boundary; the two are separate on purpose, because
 * contracts is a leaf package and cannot import core.
 */
export const moneySchema = z.int().transform((minorUnits): Money => minorUnits as Money);
