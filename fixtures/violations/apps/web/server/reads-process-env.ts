// VIOLATION: the environment is read in the composition root and nowhere else,
// through parseEnv. A second reader skips validation entirely and reintroduces
// the empty-string default ADR-0005 removed.
// Expected gate: eslint, rule no-restricted-properties.
export function connectionString(): string {
  return process.env['DATABASE_URL'] ?? '';
}
