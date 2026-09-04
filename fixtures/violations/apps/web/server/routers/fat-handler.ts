// VIOLATION: a route handler parses input, invokes a use case, and maps the
// response. Anything longer is orchestration that belongs in core.
// Expected gate: eslint, rule max-lines-per-function.
export function handleLedgerRequest(amount: number): number {
  const a1 = amount + 1;
  const a2 = a1 + 1;
  const a3 = a2 + 1;
  const a4 = a3 + 1;
  const a5 = a4 + 1;
  const a6 = a5 + 1;
  const a7 = a6 + 1;
  const a8 = a7 + 1;
  const a9 = a8 + 1;
  const a10 = a9 + 1;
  const a11 = a10 + 1;
  const a12 = a11 + 1;
  const a13 = a12 + 1;
  const a14 = a13 + 1;
  const a15 = a14 + 1;
  const a16 = a15 + 1;
  const a17 = a16 + 1;
  const a18 = a17 + 1;
  const a19 = a18 + 1;
  const a20 = a19 + 1;
  return a20;
}
