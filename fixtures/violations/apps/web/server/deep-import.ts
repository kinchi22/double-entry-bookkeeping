// VIOLATION: reaching past the package public surface into its internals.
// The `exports` field lists only ".", "./server", and "./<feature>", so this
// specifier does not resolve.
// Expected gate: typecheck (tsc), error TS2307.
import { evaluateHealth } from '@repo/core/src/health/domain/status';

export const probe = evaluateHealth;
