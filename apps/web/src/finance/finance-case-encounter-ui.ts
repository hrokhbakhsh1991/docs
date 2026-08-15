/**
 * Local re-export — CI `next build` could not resolve the workspace package
 * `@app-tour/finance-case-encounter-ui` via node_modules/package exports even
 * with transpilePackages + webpack alias. Keep a single relative bridge.
 *
 * @see docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md
 */
export * from "../../../../packages/finance-case-encounter-ui/src/index";
