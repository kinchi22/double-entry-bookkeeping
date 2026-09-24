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
  '**/next-env.d.ts',
];

export function createEslintConfig({ tsconfigRootDir, ignores = [] }) {
  return [
    { name: 'repo/ignores', ignores: [...DEFAULT_IGNORES, ...ignores] },
    ...createBaseConfig({ tsconfigRootDir }),
    boundariesConfig,
    ...nextConfigs,
    ...layerConfigs,
  ];
}
