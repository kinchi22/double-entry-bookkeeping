// VIOLATION: configuration is an input, not an ambient global. The composition
// root passes it in.
// Expected gate: eslint, rule no-restricted-properties.
export function databaseUrl(): string {
  return process.env['DATABASE_URL'] ?? '';
}
