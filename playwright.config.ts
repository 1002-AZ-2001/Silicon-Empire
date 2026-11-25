import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4179';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1366, height: 850 },
    // The game follows the browser language; scenarios are written in French.
    locale: 'fr-FR',
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4179 --strictPort',
    url: baseURL,
  },
});
