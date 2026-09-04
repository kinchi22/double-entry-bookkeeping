// VIOLATION (with cycle-b): a cycle means these two modules are really one
// module with the seam drawn in the wrong place.
// Expected gate: dependency-cruiser, rule no-circular.
import { fromB } from './cycle-b';

export function fromA(): string {
  return fromB();
}
