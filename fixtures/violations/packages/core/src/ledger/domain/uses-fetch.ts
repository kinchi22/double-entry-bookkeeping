export function ping(): Promise<Response> {
  return fetch('https://example.test/health');
}
