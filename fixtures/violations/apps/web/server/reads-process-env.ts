export function connectionString(): string {
  return process.env['DATABASE_URL'] ?? '';
}
