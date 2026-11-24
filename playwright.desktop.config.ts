import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/desktop',
  reporter: 'list',
  timeout: 60_000,
});
