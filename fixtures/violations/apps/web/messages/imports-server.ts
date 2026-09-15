// VIOLATION: a message catalogue is data, and imports nothing else in the repo.
// Expected gate: eslint, rule boundaries/dependencies.
import { handleRequest } from '../server/handler';

export const en = { status: handleRequest() } as const;
