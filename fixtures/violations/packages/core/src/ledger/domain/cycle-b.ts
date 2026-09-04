import { fromA } from './cycle-a';

export function fromB(): string {
  return fromA();
}
