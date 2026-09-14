/** @type {import('jest').Config} */
module.exports = {
  ...require('./jest.config.js'),
  setupFiles: ['<rootDir>/test/setup-performance-env.ts'],
  testMatch: ['<rootDir>/test/performance/**/*.spec.ts'],
  testTimeout: 600_000,
};
