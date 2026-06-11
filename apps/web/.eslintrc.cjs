/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: [".next/**", "node_modules/**", "next-env.d.ts"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "JSXOpeningElement[name.name='input']",
        message:
          "P3-ENTRY-02: use @app-tour/ui-primitives/input in shell wizard — no raw <input>",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@app-tour/ui-primitives",
            message:
              "P3-E-BARREL: import subpaths only — @app-tour/ui-primitives/button, /input, /select, /checkbox, /field-shell, /alert, /badge",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["src/components/ui/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-syntax": "off",
      },
    },
  ],
};
