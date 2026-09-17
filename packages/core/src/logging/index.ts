/**
 * Public surface of the logging module: how any adapter reports a failure.
 *
 * Like `money`, it is shared rather than a product feature. ADR-0018 says why it
 * is a module of its own: every adapter reports failures the same way, and what
 * of an error may be logged is a rule worth measuring.
 */
export { describeError } from './domain/describe-error';
export type { ErrorDescription } from './domain/describe-error';

export type { LogFields, Logger } from './ports/logger';
