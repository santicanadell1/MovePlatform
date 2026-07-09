import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^@move/shared$': '<rootDir>/../shared/src/index.ts',
  },
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  collectCoverageFrom: [
    'src/domain/entities/*.ts',
    'src/application/use-cases/**/*.ts',
    '!src/**/__tests__/**',
    '!src/test-setup.ts',
  ],
};

export default config;
