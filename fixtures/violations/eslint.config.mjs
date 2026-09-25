import { createEslintConfig } from '@repo/config/eslint';

export default createEslintConfig({ tsconfigRootDir: import.meta.dirname });
