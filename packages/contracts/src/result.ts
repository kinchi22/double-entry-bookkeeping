/**
 * The project error model: domain code returns a Result, it does not throw.
 *
 * A thrown error is a control-flow edge the type system cannot see, so callers
 * are never forced to handle it. A Result puts failure in the signature, which
 * makes "did we handle this case" a compile-time question.
 *
 * This lives in contracts rather than core because tRPC routers need it to map
 * failures onto HTTP, and routers are not allowed to reach into core internals.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;
