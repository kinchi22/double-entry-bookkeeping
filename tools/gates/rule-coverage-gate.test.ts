import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createEslintConfig, type EslintRuleEntry, type EslintRuleSeverity } from '@repo/config/eslint';
import {
  DEP_CRUISE_FIXTURES,
  DEP_CRUISE_RULES_WITHOUT_FIXTURE,
  LINT_FIXTURES,
  LINT_RULE_PREFIXES_WITHOUT_FIXTURE,
  LINT_RULES_WITHOUT_FIXTURE,
} from './fixture-map';
import { VIOLATIONS_DIR } from './run-gate';

const severityOf = (entry: EslintRuleEntry): EslintRuleSeverity =>
  typeof entry === 'object' ? entry[0] : entry;

const isEnabled = (entry: EslintRuleEntry): boolean => {
  const severity = severityOf(entry);
  return severity !== 'off' && severity !== 0;
};

const configuredRepoRules = (): ReadonlySet<string> => {
  const config = createEslintConfig({ tsconfigRootDir: VIOLATIONS_DIR });

  const configured = new Set<string>();
  for (const block of config) {
    if (block.name?.startsWith('repo/') !== true || block.rules === undefined) continue;
    for (const [ruleId, entry] of Object.entries(block.rules)) {
      if (isEnabled(entry)) configured.add(ruleId);
    }
  }
  return configured;
};

const isPrefixExempt = (ruleId: string): boolean =>
  Object.keys(LINT_RULE_PREFIXES_WITHOUT_FIXTURE).some((prefix) => ruleId.startsWith(prefix));

const depCruiseRules = (): ReadonlySet<string> => {
  const require = createRequire(import.meta.url);
  const preset = require('@repo/config/dep-cruiser') as {
    forbidden: readonly { name: string; severity?: string }[];
  };
  return new Set(
    preset.forbidden.filter((rule) => rule.severity !== 'ignore').map((rule) => rule.name),
  );
};

describe('lint rule coverage', () => {
  const configured = configuredRepoRules();
  const withFixture = new Set(LINT_FIXTURES.map(([, ruleId]) => ruleId));
  const exempted = new Set(Object.keys(LINT_RULES_WITHOUT_FIXTURE));

  it('has a fixture or a stated exemption for every rule the repo turns on', () => {
    const unaccounted = [...configured].filter(
      (ruleId) => !withFixture.has(ruleId) && !exempted.has(ruleId) && !isPrefixExempt(ruleId),
    );

    expect(
      unaccounted,
      'Add a fixture under fixtures/violations/ and a row in fixture-map.ts, or an ' +
        'entry in LINT_RULES_WITHOUT_FIXTURE explaining why a fixture is impossible.',
    ).toEqual([]);
  });

  it('has no fixture row for a rule the repo no longer turns on', () => {
    const stale = [...withFixture].filter((ruleId) => !configured.has(ruleId));
    expect(stale, 'The rule is gone. Delete its fixture and its row.').toEqual([]);
  });

  it('has no exemption for a rule the repo no longer turns on', () => {
    const stale = [...exempted].filter((ruleId) => !configured.has(ruleId));
    expect(stale, 'The rule is gone. Delete the exemption.').toEqual([]);
  });
});

describe('dependency-cruiser rule coverage', () => {
  const configured = depCruiseRules();
  const withFixture = new Set(DEP_CRUISE_FIXTURES.map(([name]) => name));
  const exempted = new Set(Object.keys(DEP_CRUISE_RULES_WITHOUT_FIXTURE));

  it('has a fixture or a stated exemption for every forbidden rule', () => {
    const unaccounted = [...configured].filter(
      (name) => !withFixture.has(name) && !exempted.has(name),
    );

    expect(
      unaccounted,
      'Add a fixture under fixtures/violations/ and a row in fixture-map.ts, or an ' +
        'entry in DEP_CRUISE_RULES_WITHOUT_FIXTURE explaining why a fixture is impossible.',
    ).toEqual([]);
  });

  it('has no fixture row or exemption for a rule that no longer exists', () => {
    const stale = [...withFixture, ...exempted].filter((name) => !configured.has(name));
    expect(stale, 'The rule is gone. Delete its fixture and its row.').toEqual([]);
  });
});
