/**
 * Pre-commit Jest projects: related tests for staged app sources.
 * Most unit specs use node:test (see scripts/precommit-jest-staged.mjs).
 */
/** @type {import("jest").Config} */
module.exports = {
  projects: ["<rootDir>/apps/web/jest.config.cjs"],
};
