/**
 * P4-D2 — pure helpers for cold-path product fan-in analysis.
 * @see docs/dev/p4-d2-cold-path-fan-in-ci.mdoc
 */

/**
 * Strip block + line comments (best-effort; enough for generated TS).
 * @param {string} src
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * True when specifier is a product workspace package (or subpath).
 * @param {string} specifier
 * @param {readonly string[]} productPackages
 */
export function isProductWorkspaceSpecifier(specifier, productPackages) {
  const s = specifier.trim();
  for (const pkg of productPackages) {
    if (s === pkg || s.startsWith(`${pkg}/`)) return true;
  }
  return false;
}

/**
 * @param {string} src
 * @param {readonly string[]} productPackages
 * @returns {{
 *   staticProductImports: string[];
 *   typeOnlyProductImports: string[];
 *   dynamicProductImports: string[];
 * }}
 */
export function analyzeProductFanIn(src, productPackages) {
  const code = stripComments(src);
  /** @type {string[]} */
  const staticProductImports = [];
  /** @type {string[]} */
  const typeOnlyProductImports = [];
  /** @type {string[]} */
  const dynamicProductImports = [];

  for (const m of code.matchAll(/\bimport\s+type\s+[\s\S]*?\sfrom\s*["']([^"']+)["']/g)) {
    if (isProductWorkspaceSpecifier(m[1], productPackages)) {
      typeOnlyProductImports.push(m[1]);
    }
  }

  for (const m of code.matchAll(/\bimport\s+(?!type\b)[\s\S]*?\sfrom\s*["']([^"']+)["']/g)) {
    if (isProductWorkspaceSpecifier(m[1], productPackages)) {
      staticProductImports.push(m[1]);
    }
  }

  for (const m of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    if (isProductWorkspaceSpecifier(m[1], productPackages)) {
      dynamicProductImports.push(m[1]);
    }
  }

  return { staticProductImports, typeOnlyProductImports, dynamicProductImports };
}

/**
 * Cold-path generated entrypoints that must keep static product fan-in at 0.
 * @returns {readonly string[]}
 */
export function listColdPathRelativeFiles() {
  return Object.freeze([
    "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts",
    "apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts",
    "apps/web/src/bootstrap/workspace-finance-ops-bindings.generated.ts",
    "apps/web/src/bootstrap/workspace-finance-nav-bindings.generated.ts",
    "apps/api/src/workspace/workspace-plugin-registry.generated.ts",
    "apps/api/src/http/workspace-http-handler-loaders.generated.ts",
    "apps/api/src/workspace-finance/workspace-finance-bindings.generated.ts",
    "apps/api/src/workspace-finance/workspace-finance-capabilities.generated.ts",
    "apps/api/src/workspace-finance/workspace-finance-chart-of-accounts-bindings.generated.ts",
    "apps/api/src/workspace-finance/workspace-finance-dependency-bindings.generated.ts",
    "apps/api/src/workspace-finance/workspace-finance-event-reaction-bindings.generated.ts",
    "apps/api/src/workspace-finance/workspace-finance-obligation-bindings.generated.ts",
    "packages/guest-workspace-runtime/src/workspace-plugin-register-manifest.generated.ts",
    "packages/guest-workspace-runtime/src/register-denali.generated.ts",
    "packages/guest-workspace-runtime/src/register-guest-club.generated.ts",
    "packages/guest-workspace-runtime/src/register-starter.generated.ts",
    "packages/guest-workspace-runtime/src/register-urban.generated.ts",
    "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.portal.generated.ts",
    "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.marketing.generated.ts",
    "packages/guest-workspace-runtime/src/workspace-marketing-catalog-bindings.generated.ts",
  ]);
}

/** Files that must expose at least one dynamic product import per trunk package. */
export const MIN_DYNAMIC_PRODUCT_FILES = Object.freeze([
  "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts",
  "apps/api/src/workspace/workspace-plugin-registry.generated.ts",
]);
