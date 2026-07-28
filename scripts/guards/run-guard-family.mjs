#!/usr/bin/env node
/**
 * S2 Phase 1 — grouped guard family runner (orchestration only).
 *
 * Runs existing leaf guards unchanged. Does not alter leaf logic, exit codes,
 * or CI wiring. Prints SOURCE mapping for parity/debugging.
 *
 * Usage: node scripts/guards/run-guard-family.mjs <family>
 * Families: marketing | workspace | field-exposure | guest
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {Record<string, string[]>} */
const FAMILIES = {
  marketing: [
    "guard-marketing-critical-risks.mjs",
    "guard-marketing-dead-damavand-ascent.mjs",
    "guard-marketing-dead-hero-3d.mjs",
    "guard-marketing-denali-boundary.mjs",
    "guard-marketing-fallback-shell.mjs",
    "guard-marketing-guest-theme-loader.mjs",
    "guard-marketing-home-hooks.mjs",
    "guard-marketing-home-manifest-content.mjs",
    "guard-marketing-hreflang.mjs",
    "guard-marketing-landmark.mjs",
    "guard-marketing-locale-home-hrefs.mjs",
    "guard-marketing-locale.mjs",
    "guard-marketing-meta-quality.mjs",
    "guard-marketing-nav-manifest.mjs",
    "guard-marketing-page-icons.mjs",
    "guard-marketing-primitives.mjs",
    "guard-marketing-prod-image-hosts.mjs",
    "guard-marketing-semantic-seo.mjs",
    "guard-marketing-seo-prod.mjs",
    "guard-marketing-sitemap-host.mjs",
    "guard-marketing-skin-coverage.mjs",
    "guard-marketing-skin-import-integrity.mjs",
    "guard-marketing-skin-size.mjs",
  ],
  workspace: [
    "guard-workspace-certification.mjs",
    "guard-workspace-export-surface.mjs",
    "guard-workspace-master.mjs",
    "guard-workspace-member-egress.mjs",
    "guard-workspace-onboard-contract.mjs",
    "guard-workspace-peer-import.mjs",
    "guard-workspace-plugin-load-cache.mjs",
    "guard-workspace-plugin-surface.mjs",
    "guard-workspace-theme-exports.mjs",
  ],
  "field-exposure": [
    "field-exposure-phase-0-guard.mjs",
    "field-exposure-phase-1-guard.mjs",
    "field-exposure-phase-2-guard.mjs",
    "field-exposure-phase-3-guard.mjs",
    "field-exposure-phase-4-guard.mjs",
    "field-exposure-phase-5-guard.mjs",
    "field-exposure-phase-6-guard.mjs",
    "field-exposure-phase-7-guard.mjs",
    "field-exposure-phase-8-guard.mjs",
    "field-exposure-phase-9-guard.mjs",
    "field-exposure-phase-10-guard.mjs",
    "field-exposure-phase-11-guard.mjs",
  ],
  guest: [
    "guard-guest-api-shell.mjs",
    "guard-guest-consumer-deps.mjs",
    "guard-guest-cross-surface-nav.mjs",
    "guard-guest-e2e-hooks.mjs",
    "guard-guest-extension-schema.mjs",
    "guard-guest-fetch-revalidate-parity.mjs",
    "guard-guest-frozen-shell.mjs",
    "guard-guest-plugin-conformance.mjs",
    "guard-guest-reuse-from.mjs",
    "guard-guest-runtime-product-deps.mjs",
    "guard-guest-seo-e2e-hooks.mjs",
    "guard-guest-seo.mjs",
  ],
};

function usage() {
  const names = Object.keys(FAMILIES).join(" | ");
  console.error(`Usage: node scripts/guards/run-guard-family.mjs <${names}>`);
}

const family = process.argv[2];
if (!family || !(family in FAMILIES)) {
  usage();
  process.exit(2);
}

const leafs = FAMILIES[family];
console.log(`guard-family:${family}: START (${leafs.length} leaf guards)`);

for (const leaf of leafs) {
  const rel = path.join("scripts/guards", leaf);
  const abs = path.join(REPO_ROOT, rel);
  console.log(`SOURCE: ${rel}`);
  const result = spawnSync(process.execPath, [abs], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(`guard-family:${family}: FAIL at ${rel} (exit ${code})`);
    process.exit(code);
  }
}

console.log(`guard-family:${family}: PASS (${leafs.length}/${leafs.length})`);
process.exit(0);
