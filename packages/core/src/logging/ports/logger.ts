import { type ErrorDescription } from '../domain/describe-error';

export type LogValue = string | number | boolean | ErrorDescription;

export type LogFields = {
  readonly event: string;
  readonly [field: string]: LogValue | undefined;
};

export type Logger = {
  readonly error: (fields: LogFields, message: string) => void;
};
