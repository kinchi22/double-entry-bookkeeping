// VIOLATION: a relative import that resolves to nothing is classified "unknown"
// by eslint-plugin-boundaries, which means it escaped the matrix entirely.
// Expected gate: eslint, rule boundaries/no-unknown-dependencies.
import './does-not-exist';
