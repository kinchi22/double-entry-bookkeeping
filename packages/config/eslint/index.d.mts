export type EslintRuleSeverity = 'off' | 'warn' | 'error' | 0 | 1 | 2;

export type EslintRuleEntry = EslintRuleSeverity | readonly [EslintRuleSeverity, ...unknown[]];

export type EslintConfigBlock = {
  readonly name?: string;
  readonly rules?: Readonly<Record<string, EslintRuleEntry>>;
};

export declare const DEFAULT_IGNORES: readonly string[];

export declare function createEslintConfig(options: {
  readonly tsconfigRootDir: string;
  readonly ignores?: readonly string[];
}): readonly EslintConfigBlock[];

export declare const ELEMENTS: readonly unknown[];
export declare const DEPENDENCY_POLICIES: readonly unknown[];
export declare const repoPlugin: unknown;
