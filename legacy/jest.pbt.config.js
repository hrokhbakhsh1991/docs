/**
 * Monorepo PBT Jest — property tests (*.property.spec.ts) and denali-error-handling.spec.ts.
 * Denali-only: `pnpm run test:denali` (apps/web/jest.pbt.config.js).
 */
const path = require("node:path");

/** @type {import("jest").Config} */
module.exports = {
  rootDir: path.resolve(__dirname),
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/apps/api", "<rootDir>/apps/web", "<rootDir>/packages"],
  testMatch: ["**/*.property.spec.ts", "**/denali-error-handling.spec.ts"],
  moduleNameMapper: {
    "^@/app/(.*)$": "<rootDir>/apps/web/app/$1",
    "^@/lib/(.*)$": "<rootDir>/apps/web/lib/$1",
    "^@/(.*)$": "<rootDir>/apps/web/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/apps/web/tsconfig.json",
        diagnostics: { ignoreCodes: [151001] },
      },
    ],
  },
  testTimeout: 60_000,
  maxWorkers: 1,
};
