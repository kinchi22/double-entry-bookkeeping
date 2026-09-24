export function Label({ pending }: { readonly pending: boolean }): unknown {
  return <span>{pending ? 'Checking...' : 'Re-check'}</span>;
}
