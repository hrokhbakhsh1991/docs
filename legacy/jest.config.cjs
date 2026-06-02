/** Jest is used from the repo root for `pnpm test:security` (delegates to API node:test e2e suites under apps/api). */
/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["<rootDir>/tests/security/**/*.e2e.spec.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tests/security/tsconfig.json"
      }
    ]
  },
  testTimeout: 180_000,
  maxWorkers: 1
};
