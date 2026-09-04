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

/**
 * The other gate tests prove that a rule with a fixture still fires. Neither of
 * them can see a rule that was added without a fixture: the expectation tables
 * are hand-written, so a new rule is simply absent from them and everything
 * stays green. That is the same silent-success failure mode the fixtures exist
 * to prevent, one level up.
 *
 * This test closes it by reading the shipped configuration instead of a list,
 * and asserting the list accounts for everything the configuration turns on.
 *
 * It checks both directions. A rule with no fixture and no exemption fails, and
 * so does a fixture row or exemption naming a rule that no longer exists --
 * otherwise a deleted rule would leave behind a row that quietly proves nothing.
 */

const severityOf = (entry: EslintRuleEntry): EslintRuleSeverity =>
  typeof entry === 'object' ? entry[0] : entry;

const isEnabled = (entry: EslintRuleEntry): boolean => {
  const severity = severityOf(entry);
  return severity !== 'off' && severity !== 0;
};

/**
 * Rule ids the repo's own configuration blocks switch on.
 *
 * Only blocks named `repo/*` count. Everything else in the composed config is a
 * third-party preset spread in as-is (`js.configs.recommended`,
 * `tseslint.configs.strictTypeChecked`), and this repo does not claim those.
 */
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
