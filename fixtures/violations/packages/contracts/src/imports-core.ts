// VIOLATION: contracts has zero internal dependencies. That property is what
// makes it safe for every other package to depend on it.
// Expected gate: dependency-cruiser, rule contracts-is-a-leaf.
import { LEDGER_ZERO } from '../../core/src/ledger/domain/amount';

export const zero = LEDGER_ZERO;
