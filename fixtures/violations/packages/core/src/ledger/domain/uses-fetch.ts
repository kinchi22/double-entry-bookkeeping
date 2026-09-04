// VIOLATION: network access is an effect. It belongs behind a port, implemented
// in adapters/, not called from a pure layer.
// Expected gate: eslint, rule no-restricted-globals.
export function ping(): Promise<Response> {
  return fetch('https://example.test/health');
}
