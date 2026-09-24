import { fromB } from './cycle-b';

export function fromA(): string {
  return fromB();
}
