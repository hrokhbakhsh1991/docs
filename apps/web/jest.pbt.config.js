/**
 * Denali wizard Jest — run from repo root: `pnpm run test:denali`
 *
 * Picks up denali/__tests__/integration and denali/__tests__/guards only.
 *
 * `rootDir` is the monorepo root so `@/` aliases and workspace packages resolve
 * consistently regardless of the shell cwd.
 */
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const denaliRoot = "<rootDir>/apps/web/src/features/tours/wizard/denali";

/** @type {import("jest").Config} */
module.exports = {
  rootDir: repoRoot,
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: [`${denaliRoot}/__tests__`],
  testMatch: ["**/*.(spec|property.spec|integration.test).(ts|tsx)"],
  testPathIgnorePatterns: ["<rootDir>/apps/web/.next/", "__benchmarks__"],
  modulePathIgnorePatterns: ["<rootDir>/apps/web/.next/"],
  moduleNameMapper: {
    "^@repo/denali-domain$": "<rootDir>/packages/denali-domain/src/index.ts",
    "^@repo/denali-domain/(.*)$": "<rootDir>/packages/denali-domain/src/$1",
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
