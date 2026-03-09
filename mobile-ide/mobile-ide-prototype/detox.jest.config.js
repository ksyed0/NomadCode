/** Jest config used exclusively by Detox E2E tests */
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/tests/e2e/**/*.e2e.{ts,js}'],
  testTimeout: 120000,
  maxWorkers: 1, // E2E tests must run serially (one device at a time)
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
};
