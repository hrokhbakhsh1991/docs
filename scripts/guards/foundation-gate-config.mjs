/**
 * Shared Phase 0 foundation gate scope — import from guards only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");

/**
 * Phase 0 foundation-gate only — workspace-sdk + shared config (KS-01).
 * No platform-core, design system, workspaces, or apps.
 */
export const FOUNDATION_GATE_DENALI_DIRS = ["packages/config", "packages/workspace-sdk"];

/** Per-package depcruise roots for foundation legacy-import contract (H-12). */
export const FOUNDATION_GATE_LEGACY_CRUISE_ROOTS = [
  "packages/config",
  "packages/workspace-sdk",
];

export const FOUNDATION_GATE_IMPORT_BOUNDARY_SCAN_ROOTS = ["packages/workspace-sdk"];

/** Path prefixes foundation-gate must never crawl (H-12). */
export const FOUNDATION_GATE_FORBIDDEN_CRAWL_PATHS = [
  "packages/platform-core",
  "packages/design-tokens",
  "packages/ui-primitives",
  "packages/theme-react",
  "packages/workspaces",
  "apps/",
];

/**
 * Packages built inside workspace-sdk `test:phase-0` (includes `pnpm run build` in that script).
 * Root `phase-0:foundation-gate` is `pnpm run test:phase-0` only (H-06).
 */
export const FOUNDATION_GATE_ALLOWED_BUILD_FILTERS = ["@app-tour/workspace-sdk"];

/** pnpm --filter prefixes forbidden in phase-0:foundation-gate. */
export const FOUNDATION_GATE_FORBIDDEN_BUILD_FILTERS = [
  "@app-tour/ui-primitives",
  "@app-tour/theme-react",
  "@apps/",
];

/** Repo path prefixes forbidden in phase-0:foundation-gate script text. */
export const FOUNDATION_GATE_FORBIDDEN_BUILD_PATHS = [
  "packages/ui-primitives",
  "packages/theme-react",
  "apps/",
];

/** Repo-relative roots for import-boundary-ast.mjs (RF-P0-IMP-01/02). */
/**
 * Intentional H-01 negative-proof fixture — must not fail monorepo import-boundary.
 * Proven by workspace-sdk/test/denali-coupling.contract.spec.ts (scoped depcruise).
 */
export const IMPORT_BOUNDARY_DENALI_BREACH_ALLOWLIST = [
  "packages/workspace-sdk/test/__fixtures__/denali-breach.ts",
  "packages/workspace-sdk/test/__fixtures__/capability-denali-breach.ts",
];

export const IMPORT_BOUNDARY_SCAN_ROOTS = [
  "packages/workspace-sdk",
  "packages/platform-core",
  "packages/tour-core",
  "packages/theme-react",
  "packages/design-tokens",
  "packages/ui-primitives",
  "packages/finance-core",
  "packages/workspaces/starter",
  "apps",
];

/**
 * Denali coupling scan roots — enforced by denali-coupling.contract.spec.ts (H-01).
 * depcruise rule no-denali-product-ids on production src (see test/lib/denali-cruise.ts).
 */
export const FOUNDATION_DENALI_DIRS = [
  "packages/config",
  "packages/workspace-sdk",
  "packages/platform-core",
  "packages/design-tokens",
  "packages/theme-react",
  "packages/ui-primitives",
  "packages/workspaces",
];

/** @param {string[]} relRoots */
export function resolveExistingRoots(relRoots) {
  return relRoots
    .map((rel) => path.join(REPO_ROOT, rel))
    .filter((abs) => fs.existsSync(abs));
}
