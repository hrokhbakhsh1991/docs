#!/usr/bin/env node
/**
 * Ensures `@repo/shared-contracts` capability mirror stays a re-export of `@repo/shared`
 * (Phase 5.1 — single source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const mirrorPath = path.join(
  REPO_ROOT,
  "packages/shared-contracts/src/rbac/capabilities.ts",
);

if (!fs.existsSync(mirrorPath)) {
  console.error(`[capability-registry-parity] missing mirror: ${mirrorPath}`);
  process.exit(1);
}

const mirrorSource = fs.readFileSync(mirrorPath, "utf8");

if (!mirrorSource.includes('from "@repo/shared"')) {
  console.error(
    "[capability-registry-parity] packages/shared-contracts/src/rbac/capabilities.ts must re-export from @repo/shared",
  );
  process.exit(1);
}

const requiredExports = [
  "TOUR_CAPABILITIES",
  "SETTINGS_CAPABILITIES",
  "WORKSPACE_CAPABILITY_GRANTS",
  "resolveEffectiveCapabilities",
  "normalizeProductCapabilityId",
  "PRODUCT_CAPABILITY_ALIASES",
  "TENANT_MODULE_IDS",
  "parseMembershipMetadata",
  "hasRegionalTourManageCapability",
  "MARKETING_LABEL_CAPABILITY_ALIASES",
];

for (const symbol of requiredExports) {
  if (!mirrorSource.includes(symbol)) {
    console.error(
      `[capability-registry-parity] mirror must export ${symbol}`,
    );
    process.exit(1);
  }
}

const requireCapPath = path.join(
  REPO_ROOT,
  "apps/api/src/common/casl/require-capability.decorator.ts",
);
if (!fs.existsSync(requireCapPath)) {
  fail("[phase-8] missing require-capability.decorator.ts");
}

console.log("[capability-registry-parity] OK");
