#!/usr/bin/env node
/**
 * Workspace isolation — apps/api must not import workspace host internals directly.
 * @see docs/dev/denali-plugin-encapsulation.mdoc
 */
import fs from "node:fs";
import {
  API_SRC_ROOT,
  extractImportSpecifiers,
  relFromApiSrc,
  relFromRepo,
  walkApiSrcFiles,
} from "./lib/walk-api-src.mjs";

const HOST_SETTINGS_IMPORT_RE = /@app-tour\/workspace-[a-z0-9-]+\/host\/settings\//;
const HOST_IMPORT_RE = /@app-tour\/workspace-[a-z0-9-]+\/host\//;

/**
 * Manual host wiring baseline — shrink as codegen/bindings absorb imports.
 * Paths relative to apps/api/src.
 */
const HOST_IMPORT_LEGACY_ALLOWLIST = new Set([
  "app.ts",
  "canonical/assert-tour-publish-lifecycle-gate.ts",
  "canonical/migrate-canonical-workspace.service.ts",
  "canonical/strip-form-profile-for-submit.ts",
  "denali-finance/assert-finance-access.ts",
  "denali-finance/finance.service.ts",
  "exposure/resolve-denali-surface-exposure.ts",
  "exposure/resolve-urban-surface-exposure.ts",
  "exposure/start-denali-exposure-reminder-scheduler.ts",
  "http/configure-urban-http-host.ts",
  "http/configure-workspace-denali-product-http-host.ts",
  "http/configure-workspace-finance-http-host.ts",
  "settings/bootstrap-denali-dev-smoke-fixtures.ts",
  "settings/seed-operator-smoke-catalog.ts",
  "settings/wizard-template-catalog.ts",
  "tours/apply-denali-server-clone-photo-remint.ts",
  "tours/denali-wizard-rules-module-sync.ts",
  "tours/resolve-validation-mode.ts",
  "tours/tour-wizard-photos.routes.ts",
  "tours/workspace-tour-write-dispatch.ts",
  "workspace-finance/finance.service.ts",
  "workspace-finance/prisma-workspace-outbox-reader.ts",
  "workspace-finance/infrastructure/prisma-workspace-outbox-writer.ts",
  "workspace-finance/process-workspace-finance-outbox.ts",
]);

/** @type {string[]} */
const violations = [];

for (const file of walkApiSrcFiles({ excludeGenerated: false })) {
  const relApi = relFromApiSrc(file);
  const isGenerated = file.endsWith(".generated.ts");
  const source = fs.readFileSync(file, "utf8");

  for (const spec of extractImportSpecifiers(source)) {
    if (HOST_SETTINGS_IMPORT_RE.test(spec)) {
      violations.push(`${relFromRepo(file)} — host/settings import forbidden: ${spec}`);
      continue;
    }
    if (isGenerated || HOST_IMPORT_LEGACY_ALLOWLIST.has(relApi)) {
      continue;
    }
    if (HOST_IMPORT_RE.test(spec)) {
      violations.push(
        `${relFromRepo(file)} — direct workspace host import (use generated bindings or shrink allowlist): ${spec}`
      );
    }
  }
}

if (violations.length > 0) {
  console.error("guard-api-workspace-isolation: FAIL");
  console.error(`  scope: ${API_SRC_ROOT}/**`);
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-api-workspace-isolation: PASS (apps/api workspace isolation — settings contract + host import ratchet)"
);
