import { describeError, type LogFields, type Logger } from '@repo/core';
import { type Instrumentation } from 'next';

/**
 * What a request that failed on the server is logged as. ADR-0018.
 *
 * Next calls `onRequestError` for an error it caught while rendering a page,
 * running a route handler or a Server Action, and prints the error in its own
 * format as well. This adds the searchable line: the route, not the URL, and
 * the error only as `describeError` describes it.
 *
 * Left out on purpose: the headers, which carry cookies, and the path, which
 * carries the query string. `routePath` names the route without either.
 */
export function requestErrorFields(
  ...[error, request, context]: Parameters<Instrumentation.onRequestError>
): LogFields {
  const digest = digestOf(error);
  return {
    event: 'request.failed',
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    ...(digest === undefined ? {} : { digest }),
    error: describeError(error),
  };
}

/** The id Next prints beside the error, and shows in place of it in the browser. */
function digestOf(error: unknown): string | undefined {
  const digest: unknown =
    typeof error === 'object' && error !== null ? Reflect.get(error, 'digest') : undefined;
  return typeof digest === 'string' ? digest : undefined;
}

export function createOnRequestError(logger: Logger): Instrumentation.onRequestError {
  return (...args) => {
    logger.error(requestErrorFields(...args), 'A request failed on the server.');
  };
}
