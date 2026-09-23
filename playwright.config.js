// =====================================================
// PLAYWRIGHT CONFIGURATION
// E2E testing configuration
// =====================================================

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node index.js',
    port: 3100,
    timeout: 120000,
    reuseExistingServer: true,
  },
});
