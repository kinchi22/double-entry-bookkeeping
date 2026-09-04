// VIOLATION: the design system must not learn the domain, or it cannot be
// reused or extracted.
// Expected gate: dependency-cruiser, rule ui-is-domain-agnostic.
import { LEDGER_ZERO } from '../../core/src/ledger/domain/amount';

export const zero = LEDGER_ZERO;
