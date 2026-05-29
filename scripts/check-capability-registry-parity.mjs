#!/usr/bin/env node
/**
 * Ensures `@repo/shared-contracts` capability mirror stays a re-export of `@repo/shared`
 * (Phase 5.1 — single source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportAndExit, reportFatal } from "./guardrail-report.mjs";

const SCRIPT = "check-capability-registry-parity";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const mirrorPath = path.join(
  REPO_ROOT,
  "packages/shared-contracts/src/rbac/capabilities.ts",
);

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

const requireCapPath = path.join(
  REPO_ROOT,
  "apps/api/src/common/casl/require-capability.decorator.ts",
);

function main() {
  const violations = [];

  if (!fs.existsSync(mirrorPath)) {
    violations.push(`[phase-8] missing ${path.relative(REPO_ROOT, mirrorPath)}`);
  } else {
    const mirrorSource = fs.readFileSync(mirrorPath, "utf8");

    if (!mirrorSource.includes('from "@repo/shared"')) {
      violations.push(
        `[phase-8] ${path.relative(REPO_ROOT, mirrorPath)} must re-export from "@repo/shared"`,
      );
    }

    for (const symbol of requiredExports) {
      if (!mirrorSource.includes(symbol)) {
        violations.push(
          `[phase-8] ${path.relative(REPO_ROOT, mirrorPath)} missing required export "${symbol}"`,
        );
      }
    }
  }

  if (!fs.existsSync(requireCapPath)) {
    violations.push(`[phase-8] missing ${path.relative(REPO_ROOT, requireCapPath)}`);
  }

  reportAndExit(SCRIPT, violations);
}

try {
  main();
} catch (err) {
  reportFatal(SCRIPT, err);
}
