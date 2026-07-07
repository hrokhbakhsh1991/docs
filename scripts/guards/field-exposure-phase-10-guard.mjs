#!/usr/bin/env node
/**
 * Field Exposure System — Phase 10 Denali product + M4 enterprise ops guard.
 *
 * @see docs/architecture/field-exposure-system.md#phase-10--denali-product--enterprise-ops-governance-m3m4
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const PACKAGE_JSON = join(REPO_ROOT, "package.json");
const PRE_COMMIT = join(REPO_ROOT, "scripts/pre-commit-fast.sh");
const CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-10-denali-product.contract.spec.ts",
);
const GENERATE_SCRIPT = join(REPO_ROOT, "scripts/generate-denali-settings-modules.mjs");
const GENERATED_MODULES = join(
  REPO_ROOT,
  "apps/web/src/features/settings/denali-required-settings-modules.generated.ts",
);
const DISPATCH_ROUTES = join(REPO_ROOT, "apps/api/src/openapi/dispatch-routes.ts");
const CATALOG_BINDINGS = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/catalog/denali-catalog-exposure-bindings.ts",
);
const ENRICH_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/enrich-canonical-delivery-payload.spec.ts",
);

const RUNBOOKS = [
  "docs/dev/runbooks/exposure-empty-delivery.mdoc",
  "docs/dev/runbooks/integration-gate-blocked.mdoc",
  "docs/dev/runbooks/exposure-flags.mdoc",
];

const INTEGRATION_SPECS = [
  "apps/api/test/4-integration/field-exposure-denali-catalog-redaction.spec.ts",
  "apps/api/test/4-integration/field-exposure-denali-reminder-feed.spec.ts",
  "apps/api/test/4-integration/field-exposure-audit.spec.ts",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const doc = readText(EXPOSURE_DOC);
  for (const marker of [
    "## Enterprise Closure — Milestone M3 (Denali Product)",
    "## Enterprise Closure — Milestone M4 (Enterprise Ops)",
    "### Phase 8 vs runtime authority (M4 doc alignment)",
    "### Phase 10.4 — Catalog exposure bindings audit (M3)",
    "field-exposure-denali-reminder-feed.spec.ts",
    "generate:denali-settings-modules",
    "guard:field-exposure-phase-10",
    "field-exposure-phase-10-denali-product.contract.spec.ts",
    "docs/dev/runbooks/exposure-empty-delivery.mdoc",
  ]) {
    if (!doc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing M3/M4 marker: ${marker}`);
    }
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-10")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-10");
  }

  const packageJson = readText(PACKAGE_JSON);
  for (const marker of [
    '"guard:field-exposure-phase-10"',
    '"generate:denali-settings-modules"',
  ]) {
    if (!packageJson?.includes(marker)) {
      failures.push(`package.json must wire ${marker}`);
    }
  }

  const preCommit = readText(PRE_COMMIT);
  if (!preCommit?.includes("field-exposure-phase-10-guard.mjs")) {
    failures.push("pre-commit-fast.sh must run field-exposure-phase-10-guard.mjs");
  }

  if (!existsSync(CONTRACT)) {
    failures.push("missing apps/api/test/field-exposure-phase-10-denali-product.contract.spec.ts");
  }

  for (const spec of INTEGRATION_SPECS) {
    if (!existsSync(join(REPO_ROOT, spec))) {
      failures.push(`missing ${spec}`);
    }
  }

  for (const runbook of RUNBOOKS) {
    if (!existsSync(join(REPO_ROOT, runbook))) {
      failures.push(`missing ${runbook}`);
    }
  }

  if (!existsSync(GENERATE_SCRIPT)) {
    failures.push("missing scripts/generate-denali-settings-modules.mjs");
  } else {
    const script = readText(GENERATE_SCRIPT);
    if (!script?.includes("--check")) {
      failures.push("generate-denali-settings-modules.mjs must support --check");
    }
  }

  if (!existsSync(GENERATED_MODULES)) {
    failures.push("missing denali-required-settings-modules.generated.ts");
  }

  const dispatchRoutes = readText(DISPATCH_ROUTES);
  for (const marker of [
    "/denali/dashboard/tours/{tourId}",
    "/denali/reminders/feed",
    "getDenaliDashboardTour",
    "getDenaliReminderFeed",
  ]) {
    if (!dispatchRoutes?.includes(marker)) {
      failures.push(`dispatch-routes.ts missing: ${marker}`);
    }
  }

  const bindings = readText(CATALOG_BINDINGS);
  if (bindings?.includes('"denali.approximate-return-time"')) {
    failures.push("catalog bindings must not include no-op denali.approximate-return-time");
  }

  const enrichSpec = readText(ENRICH_SPEC);
  if (!enrichSpec?.includes("denali.location-zones")) {
    failures.push("enrich-canonical-delivery-payload.spec.ts must cover denali.location-zones");
  }

  const integrationsService = readText(
    join(REPO_ROOT, "apps/api/src/integrations/http/integrations.service.ts"),
  );
  if (!integrationsService?.includes("emitSettingsResourceAudit")) {
    failures.push("integrations.service.ts must emit exposure settings audit events");
  }

  const surfacesService = readText(
    join(REPO_ROOT, "apps/api/src/exposure/workspace-exposure-surfaces.service.ts"),
  );
  if (!surfacesService?.includes("emitSettingsResourceAudit")) {
    failures.push("workspace-exposure-surfaces.service.ts must emit exposure settings audit events");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-10-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-10-guard: PASS");
}

main();
