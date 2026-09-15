// VIOLATION: a message catalogue is data. It imports nothing from the app, so
// adopting a translation library can replace it without untangling a
// dependency. Expected gate: eslint, rule boundaries/dependencies.
import { handleRequest } from '../server/handler';

export const en = { status: handleRequest() } as const;
