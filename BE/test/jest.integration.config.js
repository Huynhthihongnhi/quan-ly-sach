/** @type {import('jest').Config} */
module.exports = {
  ...require('./jest.config.js'),
  setupFiles: ['<rootDir>/test/setup-integration-env.ts'],
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
  testTimeout: 60_000,
};
