import { createBaseConfig } from './base.mjs';
import { boundariesConfig } from './boundaries.mjs';
import { layerConfigs } from './layers.mjs';
import { nextConfigs } from './next.mjs';

export { ELEMENTS, DEPENDENCY_POLICIES } from './boundaries.mjs';
export { repoPlugin } from './plugin.mjs';

export const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/reports/**',
  '**/.stryker-tmp/**',
  '**/playwright-report/**',
  '**/test-results/**',
];

/**
 * Compose the whole repo policy.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir Directory the TypeScript project
 *   service resolves tsconfigs from. Also the directory that boundaries element
 *   patterns are relative to, which is why the gate-liveness fixtures are laid
 *   out as a miniature copy of the real repo root.
 * @param {string[]} [options.ignores] Extra ignore globs.
 */
export function createEslintConfig({ tsconfigRootDir, ignores = [] }) {
  return [
    { name: 'repo/ignores', ignores: [...DEFAULT_IGNORES, ...ignores] },
    ...createBaseConfig({ tsconfigRootDir }),
    boundariesConfig,
    ...nextConfigs,
    // Layer rules come last so their no-restricted-syntax entries win over the
    // broader ones: domain files get the throw ban on top of the import() ban.
    ...layerConfigs,
  ];
}
