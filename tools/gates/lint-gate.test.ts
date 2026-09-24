import { describe, expect, it } from 'vitest';
import { LINT_FIXTURES } from './fixture-map';
import { bin, runGate, VIOLATIONS_DIR } from './run-gate';

type EslintMessage = { readonly ruleId: string | null };
type EslintResult = { readonly filePath: string; readonly messages: readonly EslintMessage[] };

const lintFixtures = (): Map<string, Set<string>> => {
  const run = runGate(bin('eslint'), ['.', '--format', 'json'], VIOLATIONS_DIR);
  expect(run.status, 'eslint must exit non-zero on the violation fixtures').not.toBe(0);

  const results = JSON.parse(run.stdout) as readonly EslintResult[];
  const byFile = new Map<string, Set<string>>();
  for (const result of results) {
    const relative = result.filePath.slice(VIOLATIONS_DIR.length + 1).replaceAll('\\', '/');
    const rules = new Set<string>();
    for (const message of result.messages) {
      if (message.ruleId !== null) rules.add(message.ruleId);
    }
    byFile.set(relative, rules);
  }
  return byFile;
};

describe('lint gate liveness', () => {
  const byFile = lintFixtures();

  it.each(LINT_FIXTURES)('%s is reported by %s', (file, ruleId) => {
    expect([...(byFile.get(file) ?? [])]).toContain(ruleId);
  });
});
