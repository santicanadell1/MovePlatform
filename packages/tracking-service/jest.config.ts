import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts', '**/*.spec.ts'],
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '^@move/shared$': '<rootDir>/../shared/dist/index.js',
  },
  collectCoverageFrom: [
    'src/domain/entities/*.ts',
    'src/application/use-cases/*.ts',
    'src/infrastructure/queues/workers/*.ts',
    'src/infrastructure/queues/workers/utils/*.ts',
    '!src/test-setup.ts',
  ],
};

export default config;
