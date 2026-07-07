#!/usr/bin/env node
/**
 * F7 — admin feature TSX palette / hex appearance ban.
 * @see docs/dev/dtcg-pipeline-spec.mdoc § F7
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanAdminFeatureAppearanceAll } from "./lib/admin-feature-appearance-ast-scan.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const { violations, scanned, purgedScanned } = scanAdminFeatureAppearanceAll(REPO_ROOT);

if (violations.length > 0) {
  console.error("guard-admin-feature-appearance-ast: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `guard-admin-feature-appearance-ast: PASS (${scanned} feature files, ${purgedScanned} F8-purged)`,
);
