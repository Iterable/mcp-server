export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/index.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 10000,
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        sourceMaps: true,
        module: { type: "es6" },
        jsc: {
          target: "es2022",
          parser: { syntax: "typescript", tsx: false },
          transform: {},
        },
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@modelcontextprotocol/(.*)$": "@modelcontextprotocol/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@t3-oss/env-core$": "<rootDir>/tests/__mocks__/@t3-oss/env-core.js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!.*(@modelcontextprotocol|@iterable))"
  ],
};
