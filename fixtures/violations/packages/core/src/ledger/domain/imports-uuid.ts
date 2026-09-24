import { v7 as uuidv7 } from 'uuid';

export function newEntryId(): string {
  return uuidv7();
}
