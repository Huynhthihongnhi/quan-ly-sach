/** @type {import('jest').Config} */
module.exports = {
  ...require('./jest.config.js'),
  setupFiles: ['<rootDir>/test/setup-contract-env.ts'],
  testMatch: ['<rootDir>/test/contract/**/*.spec.ts'],
  testTimeout: 30_000,
};
