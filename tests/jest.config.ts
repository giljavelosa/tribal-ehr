import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '@tribal-ehr/shared/(.*)': '<rootDir>/packages/shared/src/$1',
    '@tribal-ehr/shared': '<rootDir>/packages/shared/src',
    '@tribal-ehr/hl7-engine/(.*)': '<rootDir>/packages/hl7-engine/src/$1',
    '@tribal-ehr/hl7-engine': '<rootDir>/packages/hl7-engine/src',
    '@tribal-ehr/auth/(.*)': '<rootDir>/packages/auth/src/$1',
    '@tribal-ehr/auth': '<rootDir>/packages/auth/src',
    '@tribal-ehr/cds-hooks/(.*)': '<rootDir>/packages/cds-hooks/src/$1',
    '@tribal-ehr/cds-hooks': '<rootDir>/packages/cds-hooks/src',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'packages/api/src/**/*.ts',
    'packages/shared/src/**/*.ts',
    'packages/auth/src/**/*.ts',
    'packages/hl7-engine/src/**/*.ts',
    'packages/cds-hooks/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/index.ts',
  ],
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 15,
      lines: 20,
      statements: 20,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
};

export default config;
