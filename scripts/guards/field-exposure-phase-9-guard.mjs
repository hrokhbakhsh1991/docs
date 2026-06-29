#!/usr/bin/env node
/**
 * Field Exposure System — Phase 9 enterprise runtime safety guard (Milestone M2).
 *
 * @see docs/architecture/field-exposure-system.md#phase-9--runtime-safety-governance-m2
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const PACKAGE_JSON = join(REPO_ROOT, "package.json");
const API_PACKAGE = join(REPO_ROOT, "apps/api/package.json");
const PRE_COMMIT = join(REPO_ROOT, "scripts/pre-commit-fast.sh");
const CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-9-enterprise.contract.spec.ts",
);
const INTEGRATION_DIR = join(REPO_ROOT, "apps/api/test/4-integration");

const REQUIRED_INTEGRATION_SPECS = [
  "field-exposure-intent-patch.spec.ts",
  "field-exposure-intent-validation.spec.ts",
  "field-exposure-rbac.spec.ts",
  "field-exposure-lifecycle.spec.ts",
  "field-exposure-rls-isolation.spec.ts",
  "field-exposure-audit.spec.ts",
  "field-exposure-denali-catalog-redaction.spec.ts",
  "field-exposure-denali-reminder-feed.spec.ts",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const doc = readText(EXPOSURE_DOC);
  for (const marker of [
    "## Enterprise Closure — Milestone M2 (Runtime Safe)",
    "### Phase 9.10 — Fail-closed dispatch (M2 blocker)",
    "### Phase 9.1 — Exposure table consistency gate (M2)",
    "### Phase 9.5a — Orphan exposure intent cleanup",
    "### Phase 9.4 — Exposure settings RBAC",
    "guard:field-exposure-phase-9",
    "### Phase 9.7 — Playwright exposure settings",
    "denali-exposure-settings.spec.ts",
    "field-exposure-phase-9-enterprise.contract.spec.ts",
    "test:exposure:integration",
    "FIELD_EXPOSURE_ENGINE_FAIL_CLOSED",
    "FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL",
  ]) {
    if (!doc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing M2 marker: ${marker}`);
    }
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-9")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-9");
  }

  const packageJson = readText(PACKAGE_JSON);
  if (!packageJson?.includes('"guard:field-exposure-phase-9"')) {
    failures.push("package.json must wire guard:field-exposure-phase-9");
  }

  const apiPackage = readText(API_PACKAGE);
  if (!apiPackage?.includes('"test:exposure:integration"')) {
    failures.push("apps/api/package.json must define test:exposure:integration");
  }
  if (!packageJson?.includes('"test:exposure:integration"')) {
    failures.push("root package.json must define test:exposure:integration alias");
  }

  for (const rel of [
    "apps/web/tests/e2e/denali-exposure-settings.spec.ts",
    "apps/web/playwright.exposure.config.ts",
    "apps/web/test/field-exposure-phase-9-7-playwright.contract.spec.ts",
    "apps/api/src/exposure/resolve-workspace-exposure-surfaces.spec.ts",
  ]) {
    if (!existsSync(join(REPO_ROOT, rel))) {
      failures.push(`missing ${rel}`);
    }
  }

  const preCommit = readText(PRE_COMMIT);
  if (!preCommit?.includes("field-exposure-phase-9-guard.mjs")) {
    failures.push("pre-commit-fast.sh must run field-exposure-phase-9-guard.mjs");
  }

  if (!existsSync(CONTRACT)) {
    failures.push("missing apps/api/test/field-exposure-phase-9-enterprise.contract.spec.ts");
  }

  for (const spec of REQUIRED_INTEGRATION_SPECS) {
    const path = join(INTEGRATION_DIR, spec);
    if (!existsSync(path)) {
      failures.push(`missing integration spec: apps/api/test/4-integration/${spec}`);
    }
  }

  const dispatch = readText(
    join(REPO_ROOT, "apps/api/src/integrations/application/dispatch-integration-domain-event.ts"),
  );
  for (const marker of [
    "FIELD_EXPOSURE_ENGINE_FAIL_CLOSED",
    "engineSelectorMissing",
    "recordFieldExposureEngineSelectorFailure",
  ]) {
    if (!dispatch?.includes(marker)) {
      failures.push(`dispatch-integration-domain-event.ts missing M2 marker: ${marker}`);
    }
  }

  const consistency = readText(
    join(REPO_ROOT, "apps/api/src/health/migration-consistency-check.ts"),
  );
  for (const marker of [
    "REQUIRED_EXPOSURE_TABLES",
    "FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL",
    "denali_exposure_reminder_activations",
  ]) {
    if (!consistency?.includes(marker)) {
      failures.push(`migration-consistency-check.ts missing: ${marker}`);
    }
  }

  const moduleAccess = readText(
    join(REPO_ROOT, "apps/api/src/settings/settings-exposure-module-access.ts"),
  );
  if (!moduleAccess?.includes("assertWorkspaceExposureModuleAccess")) {
    failures.push("settings-exposure-module-access.ts must export assertWorkspaceExposureModuleAccess");
  }

  const integrationsService = readText(
    join(REPO_ROOT, "apps/api/src/integrations/http/integrations.service.ts"),
  );
  if (!integrationsService?.includes("deleteConnectionExposureIntentsInTransaction")) {
    failures.push("deleteIntegration must call deleteConnectionExposureIntentsInTransaction");
  }
  if (!integrationsService?.includes("loadWarnings")) {
    failures.push("integrations.service.ts must surface loadWarnings on degraded read");
  }

  const scope = readText(
    join(REPO_ROOT, "apps/api/src/exposure/connection-exposure-intent-scope.ts"),
  );
  if (!scope?.includes("findConnectionExposureIntentForEvent")) {
    failures.push("connection-exposure-intent-scope.ts must export findConnectionExposureIntentForEvent");
  }
  if (!scope?.includes("legacy scope fallback removed after 9.5b")) {
    failures.push("connection-exposure-intent-scope.ts must document 9.5b legacy fallback removal");
  }

  const failClosedSpec = join(
    REPO_ROOT,
    "apps/api/test/field-exposure-dispatch-fail-closed.spec.ts",
  );
  if (!existsSync(failClosedSpec)) {
    failures.push("missing apps/api/test/field-exposure-dispatch-fail-closed.spec.ts");
  }

  const integrationSpecCount = readdirSync(INTEGRATION_DIR).filter((name) =>
    name.startsWith("field-exposure-") && name.endsWith(".spec.ts"),
  ).length;
  if (integrationSpecCount < 6) {
    failures.push(`expected ≥6 field-exposure integration specs, found ${integrationSpecCount}`);
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-9-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-9-guard: PASS");
}

main();
