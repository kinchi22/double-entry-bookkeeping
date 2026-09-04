// VIOLATION: `any` erases the type system exactly where a domain type belongs.
// Expected gate: eslint, rule @typescript-eslint/no-explicit-any.
export type LedgerPayload = any;
