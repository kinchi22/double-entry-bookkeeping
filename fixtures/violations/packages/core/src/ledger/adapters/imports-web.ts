// VIOLATION: core depending on the delivery mechanism. This is the dependency
// that would make an AWS migration stop being a swap of apps/.
// Expected gate: eslint, rule boundaries/dependencies.
import { handleRequest } from '../../../../../apps/web/server/handler';

export const probe = handleRequest;
