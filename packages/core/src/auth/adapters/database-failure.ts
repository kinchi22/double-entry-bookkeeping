import { domainError, err, type DomainError, type Err } from '@repo/contracts';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';

/**
 * A database failure, as the auth repositories answer it: logged under `event`
 * with the error as `describeError` describes it, and returned as a generic
 * `DEPENDENCY_UNAVAILABLE`, because a driver's message names hosts and ports
 * and a message can reach a response. ADR-0018.
 */
export function databaseFailure(
  logger: Logger,
  event: string,
  error: unknown,
  message: string,
): Err<DomainError> {
  logger.error({ event, error: describeError(error) }, message);
  return err(domainError('DEPENDENCY_UNAVAILABLE', message));
}
