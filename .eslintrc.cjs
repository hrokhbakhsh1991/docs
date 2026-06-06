/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ["**/dist/**", "**/node_modules/**", "legacy/**", "reports/**", "TEMP/**"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: [
      "./packages/workspace-sdk/tsconfig.json",
      "./packages/workspace-sdk/tsconfig.test.json",
      "./packages/platform-core/tsconfig.eslint.json",
    ],
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "import"],
  rules: {
    "import/no-unresolved": ["error", { commonjs: true }],
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: [
          "./packages/workspace-sdk/tsconfig.json",
          "./packages/workspace-sdk/tsconfig.test.json",
          "./packages/platform-core/tsconfig.eslint.json",
        ],
      },
    },
  },
};
