import { domainError, err, type DomainError, type Err } from '@repo/contracts';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';

export function databaseFailure(
  logger: Logger,
  event: string,
  error: unknown,
  message: string,
): Err<DomainError> {
  logger.error({ event, error: describeError(error) }, message);
  return err(domainError('DEPENDENCY_UNAVAILABLE', message));
}
