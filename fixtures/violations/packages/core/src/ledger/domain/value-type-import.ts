// VIOLATION: a binding used only as a type must be imported with `import type`,
// or the emitted module graph carries a dependency the code does not have.
// Expected gate: eslint, rule @typescript-eslint/consistent-type-imports.
import { LedgerAmount } from './amount';

export const zero: LedgerAmount = 0;
