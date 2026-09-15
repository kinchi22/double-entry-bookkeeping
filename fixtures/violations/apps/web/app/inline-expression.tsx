// VIOLATION: copy as string literals inside a JSX expression, the shape the
// refresh button had before its copy moved. Expected gate: eslint, rule
// repo/no-inline-copy.
export function Label({ pending }: { readonly pending: boolean }): unknown {
  return <span>{pending ? 'Checking...' : 'Re-check'}</span>;
}
