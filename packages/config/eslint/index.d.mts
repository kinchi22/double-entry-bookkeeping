/**
 * Hand-written types for the ESLint preset.
 *
 * The preset itself stays plain JavaScript, because an ESLint config has to be
 * loadable by ESLint without a build step. That leaves TypeScript consumers --
 * currently tools/gates/rule-coverage-gate.test.ts, which reads the composed
 * config to check every rule has a fixture -- with no types at all, so the
 * package publishes them here rather than making each consumer cast.
 *
 * Only the shape consumers actually read is described. A config block carries
 * far more than `name` and `rules`; extra properties stay assignable, so
 * narrowing this to what is used costs nothing and avoids restating ESLint's
 * own types.
 */

export type EslintRuleSeverity = 'off' | 'warn' | 'error' | 0 | 1 | 2;

export type EslintRuleEntry = EslintRuleSeverity | readonly [EslintRuleSeverity, ...unknown[]];

export type EslintConfigBlock = {
  /** Blocks this repo authors are named `repo/*`. Spread-in presets keep theirs. */
  readonly name?: string;
  readonly rules?: Readonly<Record<string, EslintRuleEntry>>;
};

export declare const DEFAULT_IGNORES: readonly string[];

export declare function createEslintConfig(options: {
  readonly tsconfigRootDir: string;
  readonly ignores?: readonly string[];
}): readonly EslintConfigBlock[];

/**
 * Left as `unknown`: these are eslint-plugin-boundaries settings structures, and
 * restating them here would be a second source of truth that can drift from the
 * plugin's own schema. Narrow at the use site if a consumer ever needs them.
 */
export declare const ELEMENTS: readonly unknown[];
export declare const DEPENDENCY_POLICIES: readonly unknown[];
export declare const repoPlugin: unknown;
