import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'build/', 'release/', 'coverage/', 'playwright-report/', 'test-results/']),
  {
    files: ['**/*.ts', '**/*.cts', '**/*.tsx'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
);
