#!/usr/bin/env node
/**
 * Wave C.c — guest-workspace-runtime product deps must match manifests.
 * Gap Closure C.1 — fail-closed product dependency count ceiling (decrease only).
 * @see docs/dev/wave-c-guest-runtime-product-deps.mdoc
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import {
  collectGuestRuntimeProductPackages,
  verifyGuestWorkspaceRuntimePackageJson,
} from "../codegen/workspace-registry/domains/theme.mjs";

/**
 * Gap Closure Phase C.1 baseline — product workspace deps on guest-runtime.
 * Decrease when profiles/splits shrink the set; never raise without charter edit.
 */
const MAX_GUEST_RUNTIME_PRODUCT_DEPS = 4;

const manifests = discoverManifests();
const result = verifyGuestWorkspaceRuntimePackageJson(manifests);
if (!result.ok) {
  console.error("guard-guest-runtime-product-deps: FAIL");
  console.error(" expected product+platform deps:");
  for (const [name, ver] of Object.entries(result.expected)) {
    console.error(`  ${name}: ${ver}`);
  }
  console.error(" actual:");
  for (const [name, ver] of Object.entries(result.actual)) {
    console.error(`  ${name}: ${ver}`);
  }
  console.error("Run: pnpm run generate:workspace-registry");
  process.exit(1);
}

const productDeps = collectGuestRuntimeProductPackages(manifests);

if (productDeps.length > MAX_GUEST_RUNTIME_PRODUCT_DEPS) {
  console.error("guard-guest-runtime-product-deps: FAIL — product dep count exceeded ceiling");
  console.error(
    `  productDeps=${productDeps.length} ceiling=${MAX_GUEST_RUNTIME_PRODUCT_DEPS}`
  );
  console.error(`  packages: ${productDeps.join(", ")}`);
  console.error("  See docs/dev/saas-platform-remediation.mdoc (Phase C.1)");
  process.exit(1);
}

console.log(
  `guard-guest-runtime-product-deps: PASS (productDeps=${productDeps.length}/${MAX_GUEST_RUNTIME_PRODUCT_DEPS})`
);
