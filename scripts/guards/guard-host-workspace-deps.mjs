#!/usr/bin/env node
/**
 * Wave I.0 / I.7 / I.8 / PSR-4b-api-deps / PSR-4b-api-deps-sync —
 * apps/web + apps/api workspace product deps vs manifests.
 * @see docs/dev/wave-i-0-architecture-guard-matrix.mdoc
 * @see docs/dev/wave-i-7-host-install-classification.mdoc
 * @see docs/dev/wave-i-8-admin-web-product-deps.mdoc
 * @see docs/audits/snapshots/2026-07-31/psr-4b-api-deps.mdoc
 * @see docs/audits/snapshots/2026-07-31/psr-4b-api-deps-sync.mdoc
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import {
  verifyAdminWebPackageJson,
  verifyApiPackageJson,
} from "../codegen/workspace-registry/domains/theme.mjs";
import { REPO_ROOT } from "../codegen/workspace-registry/constants.mjs";

const SDK_PACKAGE = "@app-tour/workspace-sdk";
const API_PACKAGE_JSON = join(REPO_ROOT, "apps/api/package.json");
const WEB_PACKAGE_JSON = join(REPO_ROOT, "apps/web/package.json");
const HOST_PACKAGE_JSON = Object.freeze([WEB_PACKAGE_JSON, API_PACKAGE_JSON]);

/**
 * @param {unknown} pkg
 * @returns {string[]}
 */
function collectWorkspaceProductDeps(pkg) {
  /** @type {Set<string>} */
  const names = new Set();
  if (typeof pkg !== "object" || pkg === null) {
    return [];
  }
  const record = /** @type {Record<string, unknown>} */ (pkg);
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const block = record[section];
    if (typeof block !== "object" || block === null || Array.isArray(block)) {
      continue;
    }
    for (const name of Object.keys(/** @type {Record<string, unknown>} */ (block))) {
      if (name.startsWith("@app-tour/workspace-") && name !== SDK_PACKAGE) {
        names.add(name);
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {ReturnType<typeof discoverManifests>} manifests
 * @returns {Set<string>}
 */
function expectedManifestPackages(manifests) {
  /** @type {Set<string>} */
  const packages = new Set();
  for (const manifest of manifests) {
    if (typeof manifest.package === "string" && manifest.package.length > 0) {
      packages.add(manifest.package);
    }
  }
  return packages;
}

const manifests = discoverManifests();
const expected = expectedManifestPackages(manifests);
/** @type {string[]} */
const failures = [];

for (const packageJsonPath of HOST_PACKAGE_JSON) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const declared = collectWorkspaceProductDeps(pkg);
  const orphans = declared.filter((name) => !expected.has(name));
  if (orphans.length > 0) {
    const rel = packageJsonPath.slice(REPO_ROOT.length + 1);
    failures.push(`${rel}: orphan workspace product deps (not in any workspace.manifest.json):`);
    for (const name of orphans) {
      failures.push(`  ${name}`);
    }
  }
}

/** PSR-4b-api-deps-sync — API dependencies must match generate/sync writer (exact sorted set). */
{
  const apiCheck = verifyApiPackageJson(manifests);
  if (!apiCheck.ok) {
    failures.push(
      "apps/api/package.json: workspace product deps drift from manifests (PSR-4b-api-deps-sync).",
    );
    failures.push("  Run: pnpm run generate:workspace-registry");
  }
}

const webCheck = verifyAdminWebPackageJson(manifests);
if (!webCheck.ok) {
  failures.push(
    "apps/web/package.json: product workspace deps drift from product trunk (Wave I.8).",
  );
  failures.push("  Run: pnpm run generate:workspace-registry");
}

if (failures.length > 0) {
  console.error("guard-host-workspace-deps: FAIL");
  for (const line of failures) {
    console.error(line);
  }
  console.error(
    "Remove the orphan dep, or run generate:workspace-registry to sync apps/web + apps/api product deps.",
  );
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(WEB_PACKAGE_JSON, "utf8"));
const webProducts = collectWorkspaceProductDeps(pkg);
const apiProducts = collectWorkspaceProductDeps(
  JSON.parse(readFileSync(API_PACKAGE_JSON, "utf8")),
);

console.log(
  `guard-host-workspace-deps: PASS (${HOST_PACKAGE_JSON.length} hosts, ${expected.size} manifest packages, ${webProducts.length} web product trunk deps, ${apiProducts.length} api product deps exact)`,
);
