export function databaseUrl(): string {
  return process.env['DATABASE_URL'] ?? '';
}
