// VIOLATION: copy as string literals a JSX expression renders, one per arm of
// a ternary. Expected gate: eslint, rule repo/no-inline-copy.
export function Label({ pending }: { readonly pending: boolean }): unknown {
  return <span>{pending ? 'Checking...' : 'Re-check'}</span>;
}
