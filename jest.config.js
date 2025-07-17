module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.js', '**/__tests__/**/*.js'],
  collectCoverageFrom: [
    'server.js',
    'utils/**/*.js',
    'config/**/*.js',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 10000
}; 