/**
 * Monorepo ESLint root — zero-tolerance (errors only, no warnings).
 * Apps extend this file; `pnpm eslint` and lint-staged use `--max-warnings 0`.
 */
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  reportUnusedDisableDirectives: true,
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/*.d.ts",
    "reports/**",
    "apps/web/.storybook/**",
    "apps/web/stories/**",
    "apps/web/typedoc-out/**",
    "apps/web/storybook-static/**",
    "apps/web/dist-memlab/**",
    "apps/web/.memlab/**",
    "**/*.stories.ts",
    "**/*.stories.tsx",
    "**/*.stories.mdx",
  ],
  plugins: ["boundaries", "@typescript-eslint", "import", "test-pairing"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/strict",
  ],
  rules: {
    strict: ["error", "never"],
    "no-console": "error",
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/features/*/**"],
            message:
              "Direct imports from feature internals are forbidden. Use the feature barrel file.",
          },
        ],
      },
    ],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/explicit-module-boundary-types": "off",
  },
  overrides: [
    {
      files: [
        "**/scripts/**/*.{js,cjs,mjs,ts,tsx}",
        "**/*.config.{js,cjs,mjs,ts}",
        "**/.eslintrc.cjs",
        "packages/config/eslint.base.cjs",
        "dependency-cruiser.config.js",
        "packages/ui/.eslintrc.cjs",
      ],
      env: { node: true },
      rules: {
        strict: "off",
        "no-console": "off",
        "no-undef": "off",
        "no-empty": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    {
      files: [
        "**/*.{spec,test}.{ts,tsx}",
        "**/*.{e2e-spec,unit-spec,integration-spec}.{ts,tsx}",
        "**/*.integration-spec.ts",
        "**/__tests__/**/*.{ts,tsx}",
      ],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-require-imports": "off",
        "prefer-const": "off",
        "no-empty": "off",
      },
    },
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      settings: {
        "boundaries/include": [
          "apps/web/app/**/*.{ts,tsx}",
          "apps/web/src/**/*.{ts,tsx}",
          "apps/web/lib/**/*.{ts,tsx}",
        ],
        "boundaries/ignore": ["**/*.{spec,test}.{ts,tsx}", "**/__tests__/**"],
        "boundaries/elements": [
          { type: "services", pattern: "apps/web/lib/services/**" },
          { type: "services", pattern: "apps/web/src/features/**/services/**" },
          { type: "ui", pattern: "apps/web/src/components/**" },
          { type: "ui", pattern: "apps/web/src/features/**/components/**" },
          { type: "ui", pattern: "apps/web/src/features/**/steps/**" },
          { type: "ui", pattern: "apps/web/src/**/ui/**" },
          { type: "ui", pattern: "apps/web/src/features/**/groups/**" },
          { type: "ui", pattern: "apps/web/app/**" },
          { type: "hooks", pattern: "apps/web/src/**/hooks/**" },
          { type: "hooks", pattern: "apps/web/lib/hooks/**" },
          { type: "domain", pattern: "apps/web/src/features/**/domain/**" },
          { type: "shared", pattern: "apps/web/src/lib/**" },
          { type: "shared", pattern: "apps/web/src/features/**/schemas/**" },
          { type: "shared", pattern: "apps/web/src/features/**/adapters/**" },
          { type: "shared", pattern: "apps/web/src/features/**/testing/**" },
          { type: "shared", pattern: "apps/web/lib/**" },
        ],
      },
      rules: {
        "boundaries/dependencies": [
          "error",
          {
            default: "disallow",
            rules: [
              { from: { type: "ui" }, allow: { to: { type: ["hooks"] } } },
              {
                from: { type: "hooks" },
                allow: { to: { type: ["services", "domain", "shared"] } },
              },
              {
                from: { type: "services" },
                allow: { to: { type: ["domain", "shared"] } },
              },
              { from: { type: "domain" }, allow: { to: { type: ["shared"] } } },
              { from: { type: "shared" }, allow: { to: { type: ["shared"] } } },
              {
                from: {
                  type: ["ui", "hooks", "services", "domain", "shared"],
                },
                allow: { to: { origin: "external" } },
              },
            ],
          },
        ],
      },
    },
    {
      files: ["apps/api/**/*.ts"],
      settings: {
        "boundaries/include": ["apps/api/src/**/*.ts", "apps/api/test/**/*.ts"],
        "boundaries/ignore": ["**/*.{spec,test}.ts", "**/__tests__/**"],
        // Phase 4 (MAP §62): API layering is enforced by tests/architecture/boundary-scanner.ts
        // (domain / app / infra). Legacy element types below are documentation-only until
        // modules adopt canonical folders and ESLint rules are re-enabled.
        "boundaries/elements": [
          {
            type: "app",
            pattern: "apps/api/src/**/*.controller.ts",
            mode: "file",
          },
          { type: "app", pattern: "apps/api/src/**/controllers/**/*.ts" },
          { type: "app", pattern: "apps/api/src/**/application/**" },
          {
            type: "app",
            pattern: "apps/api/src/**/*.service.ts",
            mode: "file",
          },
          { type: "app", pattern: "apps/api/src/**/services/**" },
          {
            type: "hooks",
            pattern: "apps/api/src/**/*.guard.ts",
            mode: "file",
          },
          {
            type: "hooks",
            pattern: "apps/api/src/**/*.interceptor.ts",
            mode: "file",
          },
          { type: "hooks", pattern: "apps/api/src/**/middleware/**" },
          { type: "domain", pattern: "apps/api/src/**/domain/**" },
          { type: "domain", pattern: "apps/api/src/**/policies/**" },
          {
            type: "infra",
            pattern: "apps/api/src/**/entities/**",
          },
          {
            type: "infra",
            pattern: "apps/api/src/**/repositories/**",
          },
          {
            type: "infra",
            pattern: "apps/api/src/**/adapters/**",
          },
          { type: "infra", pattern: "apps/api/src/infra/**" },
          { type: "shared", pattern: "apps/api/src/common/**" },
          { type: "shared", pattern: "apps/api/src/config/**" },
          { type: "shared", pattern: "apps/api/src/database/**" },
        ],
      },
      rules: {
        // Disabled: conflicts with MAP §62 (entities = infra, not domain) and duplicates
        // tests/architecture/boundary-scanner.ts during the app/domain/infra migration.
        "boundaries/dependencies": "off",
      },
    },
    {
      files: ["packages/shared/rbac/workspace-roles.ts"],
      rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: ["packages/**/*.{ts,tsx}"],
      rules: {},
    },
    {
      files: ["apps/web/scripts/**/*.ts", "scripts/**/*.ts"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
    {
      files: [
        "apps/web/src/features/**/*.{ts,tsx}",
        "apps/web/lib/services/**/*.ts",
        "apps/web/src/services/**/*.ts",
        "apps/web/services/**/*.ts",
      ],
      rules: {
        "test-pairing/require-test-pair": "error",
      },
    },
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      excludedFiles: [
        "**/*.{spec,test}.{ts,tsx}",
        "**/*.{e2e-spec,unit-spec,integration-spec}.{ts,tsx}",
        "**/__tests__/**",
        "apps/web/scripts/**",
      ],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-dynamic-delete": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-empty": "off",
        "@typescript-eslint/no-extraneous-class": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-invalid-void-type": "off",
        "react-hooks/exhaustive-deps": "off",
      },
    },
    {
      files: ["packages/**/*.{ts,tsx}"],
      excludedFiles: ["**/*.{spec,test}.{ts,tsx}", "**/__tests__/**"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-dynamic-delete": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-empty": "off",
        "@typescript-eslint/no-extraneous-class": "off",
        "@typescript-eslint/ban-types": "off",
      },
    },
    {
      files: ["apps/api/**/*.ts"],
      excludedFiles: [
        "**/*.{spec,test}.ts",
        "**/*.{e2e-spec,unit-spec,integration-spec}.ts",
        "**/*.integration-spec.ts",
        "**/__tests__/**",
      ],
      rules: {
        "@typescript-eslint/no-extraneous-class": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-dynamic-delete": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/triple-slash-reference": "off",
        "no-useless-escape": "off",
        "no-constant-condition": "off",
      },
    },
    {
      files: ["apps/telegram/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
      },
    },
    {
      files: ["scripts/**/*.{js,mjs,cjs,ts}", "apps/web/scripts/**/*.ts"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "no-useless-escape": "off",
        "no-redeclare": "off",
        "no-constant-condition": "off",
        "@typescript-eslint/triple-slash-reference": "off",
      },
    },
    {
      files: ["packages/ui/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
      },
    },
  ],
};
