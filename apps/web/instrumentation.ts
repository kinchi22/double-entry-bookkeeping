import { createLogger, stderr } from './server/logger';
import { createOnRequestError } from './server/request-error';

export const onRequestError = createOnRequestError(createLogger(stderr()));
