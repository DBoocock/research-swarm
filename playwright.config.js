import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1,
  webServer: {
    command: 'npm run build --silent 2>/dev/null; npx vite preview --port 3001',
    port: 3001,
    reuseExistingServer: true,
    timeout: 60000,
  },
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
});
