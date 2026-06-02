/**
 * Shared ESLint baseline for packages that opt in via `extends` / spread.
 * Zero-tolerance: strict TypeScript rules, errors only (pair with --max-warnings 0).
 */
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  reportUnusedDisableDirectives: true,
  env: {
    es2022: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/strict",
  ],
  rules: {
    strict: ["error", "never"],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
};
