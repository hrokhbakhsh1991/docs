#!/usr/bin/env node
/**
 * Gap Closure C.2a — fail-closed product package ceilings for generated transpile lists.
 * Counts only `@app-tour/workspace-*` product deps (excludes sdk / plugin-host).
 * @see docs/dev/saas-platform-remediation.mdoc
 * @see docs/dev/wave-c-guest-transpile-packages.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import {
  collectAdminProductTranspilePackages,
  collectGuestProductTranspilePackages,
  isGuestRuntimeProductWorkspaceDep,
} from "../codegen/workspace-registry/domains/theme.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Same product set size as guest-runtime C.1 ceiling — decrease only. */
const MAX_TRANSPILE_PRODUCT_PACKAGES = 4;

/**
 * @param {string} relPath
 * @param {string} exportName
 * @returns {Promise<readonly string[]>}
 */
async function loadGeneratedList(relPath, exportName) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`missing generated transpile list: ${relPath}`);
  }
  const mod = await import(pathToFileURL(abs).href);
  const list = mod[exportName];
  if (!Array.isArray(list)) {
    throw new Error(`${relPath}: export ${exportName} is not an array`);
  }
  return list;
}

/**
 * @param {readonly string[]} list
 * @returns {string[]}
 */
function productPackagesFromList(list) {
  return list.filter((name) => isGuestRuntimeProductWorkspaceDep(name)).sort((a, b) => a.localeCompare(b));
}

const manifests = discoverManifests();
const expectedPortal = collectGuestProductTranspilePackages(manifests, "portal");
const expectedMarketing = collectGuestProductTranspilePackages(manifests, "marketing");
const expectedAdmin = collectAdminProductTranspilePackages(manifests);

const [portalList, marketingList, adminList] = await Promise.all([
  loadGeneratedList(
    "apps/portal/src/bootstrap/guest-transpile-packages.generated.mjs",
    "GUEST_TRANSPILE_PACKAGES"
  ),
  loadGeneratedList(
    "apps/marketing/src/bootstrap/guest-transpile-packages.generated.mjs",
    "GUEST_TRANSPILE_PACKAGES"
  ),
  loadGeneratedList(
    "apps/web/src/bootstrap/admin-transpile-packages.generated.mjs",
    "ADMIN_TRANSPILE_PACKAGES"
  ),
]);

const checks = [
  { label: "portal-generated", products: productPackagesFromList(portalList), expected: expectedPortal },
  {
    label: "marketing-generated",
    products: productPackagesFromList(marketingList),
    expected: expectedMarketing,
  },
  { label: "admin-generated", products: productPackagesFromList(adminList), expected: expectedAdmin },
  { label: "portal-manifest", products: expectedPortal, expected: expectedPortal },
  { label: "marketing-manifest", products: expectedMarketing, expected: expectedMarketing },
  { label: "admin-manifest", products: expectedAdmin, expected: expectedAdmin },
];

let failed = false;
for (const check of checks) {
  if (check.products.length > MAX_TRANSPILE_PRODUCT_PACKAGES) {
    failed = true;
    console.error(
      `guard-transpile-product-ceiling: FAIL — ${check.label} product count ${check.products.length} > ceiling ${MAX_TRANSPILE_PRODUCT_PACKAGES}`
    );
    console.error(`  packages: ${check.products.join(", ")}`);
  }
  const live = check.products.join("\n");
  const expected = [...check.expected].sort((a, b) => a.localeCompare(b)).join("\n");
  if (live !== expected && check.label.endsWith("-generated")) {
    failed = true;
    console.error(
      `guard-transpile-product-ceiling: FAIL — ${check.label} product set drifted from manifests`
    );
    console.error(`  live: ${check.products.join(", ") || "(none)"}`);
    console.error(`  expected: ${check.expected.join(", ") || "(none)"}`);
  }
}

if (failed) {
  console.error("  See docs/dev/saas-platform-remediation.mdoc (Phase C.2a)");
  process.exit(1);
}

console.log(
  `guard-transpile-product-ceiling: PASS (portal=${expectedPortal.length}/${MAX_TRANSPILE_PRODUCT_PACKAGES} marketing=${expectedMarketing.length}/${MAX_TRANSPILE_PRODUCT_PACKAGES} admin=${expectedAdmin.length}/${MAX_TRANSPILE_PRODUCT_PACKAGES})`
);
