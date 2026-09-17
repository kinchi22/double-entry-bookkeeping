import { createLogger, stderr } from './server/logger';
import { createOnRequestError } from './server/request-error';

/**
 * Next's instrumentation hook. Every server-side request error is also logged
 * as one JSON line; `server/request-error.ts` decides what the line holds.
 * ADR-0018.
 *
 * Wiring only, like the composition root, which this file cannot import:
 * `container.ts` imports `server-only`, and Next loads this module outside the
 * React server environment.
 */
export const onRequestError = createOnRequestError(createLogger(stderr()));
