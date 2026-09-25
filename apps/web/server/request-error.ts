import { describeError, type LogFields, type Logger } from '@repo/core';
import { type Instrumentation } from 'next';

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
