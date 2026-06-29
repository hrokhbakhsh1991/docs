#!/usr/bin/env node
/**
 * Field Exposure System — Phase 8 enterprise hardening guard.
 *
 * @see docs/architecture/field-exposure-system.md#phase-8--enterprise-hardening
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
const SCHEMA = join(REPO_ROOT, "apps/api/prisma/schema.prisma");
const EXPOSURE_PROFILES_MIGRATION = join(
  REPO_ROOT,
  "apps/api/prisma/migrations/20260701100000_exposure_profiles/migration.sql",
);
const APP = join(REPO_ROOT, "apps/api/src/app.ts");
const API_ROUTE = join(REPO_ROOT, "apps/api/src/exposure/exposure.routes.ts");
const API_SERVICE = join(REPO_ROOT, "apps/api/src/exposure/exposure-catalog.service.ts");
const RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/resolve-exposure-decision.ts");
const FIELD_EXPOSURE_POLICY = join(REPO_ROOT, "apps/api/src/exposure/field-exposure-policy.ts");
const PROFILE_REPO = join(REPO_ROOT, "apps/api/src/exposure/prisma-exposure-profile.repository.ts");
const PERSISTED_PROFILE = join(
  REPO_ROOT,
  "apps/api/src/exposure/resolve-persisted-exposure-profile.ts",
);
const SHADOW_DIAGNOSTICS = join(
  REPO_ROOT,
  "apps/api/src/exposure/field-exposure-shadow-diagnostics.ts",
);
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);
const RUNTIME_MODE = join(REPO_ROOT, "apps/api/src/exposure/exposure-runtime-mode.ts");
const METRICS = join(REPO_ROOT, "apps/api/src/observability/metrics.ts");
const STARTER_MANIFEST = join(
  REPO_ROOT,
  "packages/workspace-sdk/src/reference/starter-field-policy.manifest.ts",
);
const WEB_PROXY = join(
  REPO_ROOT,
  "apps/web/app/api/workspaces/[workspaceId]/exposure/catalog/route.ts",
);
const WEB_CLIENT = join(REPO_ROOT, "apps/web/src/exposure/exposure-catalog-client.ts");
const WEB_SERVER = join(REPO_ROOT, "apps/web/src/exposure/fetch-exposure-catalog.server.ts");
const EXPOSURE_PAGE = join(REPO_ROOT, "apps/web/app/(app)/settings/exposure/page.tsx");
const EXPOSURE_CLIENT = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx",
);
const INTEGRATIONS_PAGE = join(REPO_ROOT, "apps/web/app/(app)/settings/integrations/page.tsx");
const INTEGRATIONS_CLIENT = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx",
);
const CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-8-enterprise-hardening.contract.spec.ts",
);

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const doc = readText(EXPOSURE_DOC);
  for (const marker of [
    "## Phase 8 — Enterprise Hardening",
    "Phase 8 complete",
    "Authoritative exposure resolver contract (8d)",
    "resolveExposureDecision",
    "fieldExposureDecision",
    "FIELD_EXPOSURE_SHADOW_DIAGNOSTICS",
    "restrictFieldExposureCandidates",
    "Native catalog API contract (8c)",
    "/workspaces/:workspaceId/exposure/catalog",
    "guard:field-exposure-phase-8",
    "field-exposure-phase-8-enterprise-hardening.contract.spec.ts",
  ]) {
    if (!doc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing Phase 8 marker: ${marker}`);
    }
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-8")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-8");
  }

  const packageJson = readText(PACKAGE_JSON);
  if (!packageJson?.includes('"guard:field-exposure-phase-8"')) {
    failures.push("package.json must wire guard:field-exposure-phase-8");
  }

  const preCommit = readText(PRE_COMMIT);
  if (!preCommit?.includes("field-exposure-phase-8-guard.mjs")) {
    failures.push("pre-commit-fast.sh must run field-exposure-phase-8-guard.mjs");
  }

  for (const path of [
    APP,
    SCHEMA,
    EXPOSURE_PROFILES_MIGRATION,
    API_ROUTE,
    API_SERVICE,
    RESOLVER,
    FIELD_EXPOSURE_POLICY,
    PROFILE_REPO,
    PERSISTED_PROFILE,
    SHADOW_DIAGNOSTICS,
    DISPATCH,
    WEB_PROXY,
    WEB_CLIENT,
    WEB_SERVER,
    EXPOSURE_PAGE,
    EXPOSURE_CLIENT,
    INTEGRATIONS_PAGE,
    INTEGRATIONS_CLIENT,
    CONTRACT,
  ]) {
    if (!existsSync(path)) {
      failures.push(`missing ${path.replace(`${REPO_ROOT}/`, "")}`);
    }
  }

  const app = readText(APP);
  if (!app?.includes("/exposure\\/catalog")) {
    failures.push("app.ts must route /workspaces/:workspaceId/exposure/catalog");
  }

  const schema = readText(SCHEMA);
  if (!schema?.includes("model ExposureProfile")) {
    failures.push("schema.prisma must define persisted ExposureProfile");
  }

  const resolver = readText(RESOLVER);
  for (const marker of ["EXPOSURE_RESOLVER_VERSION", "FieldExposureDecision", "restrictFieldExposureCandidates"]) {
    if (!resolver?.includes(marker)) {
      failures.push(`resolve-exposure-decision.ts missing: ${marker}`);
    }
  }

  const dispatch = readText(DISPATCH);
  for (const marker of [
    "resolveExposureDecision",
    "fieldExposureDecision",
    "resolvePersistedExposureProfileForContext",
    "resolveFieldExposureShadowDiagnostics",
    "recordFieldExposureDecisionAudited",
  ]) {
    if (!dispatch?.includes(marker)) {
      failures.push(`dispatch missing Phase 8 marker: ${marker}`);
    }
  }

  const runtime = readText(RUNTIME_MODE);
  if (!runtime?.includes('source: "exposure_resolver"')) {
    failures.push("exposure-runtime-mode.ts must use exposure_resolver source");
  }

  const metrics = readText(METRICS);
  if (!metrics?.includes("field_exposure_decision_audited_total")) {
    failures.push("metrics must define field_exposure_decision_audited_total");
  }

  const starter = readText(STARTER_MANIFEST);
  if (!starter?.includes('surface: "delivery"')) {
    failures.push("starter field policy manifest must keep transitional delivery surface");
  }
  if (starter?.includes('surface: "telegram"')) {
    failures.push("starter field policy manifest must remain provider-agnostic (no telegram surface)");
  }

  const apiService = readText(API_SERVICE);
  if (!apiService?.includes("buildExposureSelectableFieldCatalog")) {
    failures.push("exposure catalog service must build the exposure-owned catalog");
  }

  const exposurePage = readText(EXPOSURE_PAGE);
  if (!exposurePage?.includes("fetchWorkspaceExposureCatalogServer")) {
    failures.push("settings/exposure page must fetch native exposure catalog server-side");
  }

  const exposureClient = readText(EXPOSURE_CLIENT);
  if (!exposureClient?.includes("fetchWorkspaceExposureCatalog")) {
    failures.push("settings/exposure client must refresh native exposure catalog");
  }
  if (exposureClient?.includes("meta.exposureCandidateFields")) {
    failures.push("settings/exposure client must not source checklist fields from integration meta");
  }

  const integrationsPage = readText(INTEGRATIONS_PAGE);
  if (!integrationsPage?.includes("fetchWorkspaceExposureCatalogServer")) {
    failures.push("integrations page must fetch native exposure catalog server-side");
  }

  const integrationsClient = readText(INTEGRATIONS_CLIENT);
  if (!integrationsClient?.includes("fetchWorkspaceExposureCatalog")) {
    failures.push("integrations client must refresh native exposure catalog");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-8-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-8-guard: PASS");
}

main();
