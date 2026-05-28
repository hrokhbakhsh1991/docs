/**
 * Denali wizard Jest — run from repo root: `pnpm run test:denali`
 *
 * `rootDir` is the monorepo root so `@/` aliases and workspace packages resolve
 * consistently regardless of the shell cwd.
 */
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

/** @type {import("jest").Config} */
module.exports = {
  rootDir: repoRoot,
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/apps/web/src/features/tours/wizard/denali/__tests__"],
  testMatch: ["**/*.(spec|property.spec|integration.test).(ts|tsx)"],
  modulePathIgnorePatterns: ["<rootDir>/apps/web/.next/"],
  moduleNameMapper: {
    "^@/app/(.*)$": "<rootDir>/apps/web/app/$1",
    "^@/lib/(.*)$": "<rootDir>/apps/web/lib/$1",
    "^@/(.*)$": "<rootDir>/apps/web/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/apps/web/jest.styleMock.cjs",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/apps/web/tsconfig.jest.json",
        diagnostics: { ignoreCodes: [151001] },
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/apps/web/jest.setup.ts"],
  testTimeout: 60_000,
  maxWorkers: 1,
};
