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
        selector:
          "JSXAttribute[name.name='style'] ObjectExpression > Property[key.name=/^--(color|primary|background|border|accent|foreground)/]",
        message:
          "CSS ownership: guest surfaces must not set appearance CSS variables inline — use workspace skin (L3).",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@app-tour/ui-primitives",
            message:
              "P3-E-BARREL: import subpaths only — @app-tour/ui-primitives/button, /input, …",
          },
          {
            name: "@app-tour/workspace-denali",
            message: "Portal shell must not static-import workspace plugins — use API BFF",
          },
          {
            name: "@app-tour/workspace-urban",
            message: "Portal shell must not static-import workspace plugins — use API BFF",
          },
        ],
      },
    ],
  },
};
