/** @type {import('jest').Config} */
module.exports = {
  ...require('./jest.config.js'),
  setupFiles: ['<rootDir>/test/setup-integration-env.ts'],
  testMatch: ['<rootDir>/test/security/**/*.spec.ts'],
  testTimeout: 120_000,
};
