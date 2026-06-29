#!/usr/bin/env node
/**
 * Field Exposure System — Phase 7 retirement guard (full closure: 7e–7i).
 *
 * @see docs/architecture/field-exposure-system.md#phase-7--remove-integration-owned-selection
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const SCHEMA = join(REPO_ROOT, "apps/api/prisma/schema.prisma");
const POLICY_REPO = join(
  REPO_ROOT,
  "apps/api/src/integrations/infrastructure/integration-policy.repository.ts"
);
const ROUTING_ONLY_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/infrastructure/integration-policy-routing-only.spec.ts"
);
const COLUMN_DROP_MIGRATION = join(
  REPO_ROOT,
  "apps/api/prisma/migrations/20260629120000_remove_integration_event_policy_delivery_columns/migration.sql"
);
const DROP_DELIVERY_INTENTS_MIGRATION = join(
  REPO_ROOT,
  "apps/api/prisma/migrations/20260630100000_drop_integration_delivery_intents/migration.sql"
);
const SURFACE_META = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/integration-surface-meta.ts"
);
const WEB_TYPES = join(REPO_ROOT, "apps/web/src/integrations/integrations-types.ts");
const PHASE_7_CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-7-retirement.contract.spec.ts"
);
const EXPOSURE_PAGE = join(REPO_ROOT, "apps/web/app/(app)/settings/exposure/page.tsx");
const EXPOSURE_INTENT_ROUTE = join(
  REPO_ROOT,
  "apps/web/app/api/integrations/[id]/exposure-intents/[eventType]/route.ts"
);
const INTEGRATIONS_SERVICE = join(
  REPO_ROOT,
  "apps/api/src/integrations/http/integrations.service.ts"
);
const POLICY_ENGINE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/integration-policy-engine.ts"
);
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts"
);

const RETIRED_PATHS = [
  "apps/api/src/integrations/domain/integration-delivery-intent.ts",
  "apps/api/src/exposure/integration-delivery-intent-adapter.ts",
  "apps/api/src/exposure/integration-delivery-intent-write-bridge.ts",
  "apps/web/app/api/integrations/[id]/delivery-intents/[eventType]/route.ts",
];

const REQUIRED_DOC_MARKERS = [
  "## Phase 7 — Remove Integration-Owned Selection",
  "Subphase status (authoritative)",
  "Phase 7 complete",
  "settings/exposure",
  "exposure-intents",
  "guard:field-exposure-phase-7",
  "field-exposure-phase-7-retirement.contract.spec.ts",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const exposureDoc = readText(EXPOSURE_DOC);
  if (!exposureDoc?.includes("Phase 7 complete")) {
    failures.push("field-exposure-system.md must mark Phase 7 complete");
  }
  for (const marker of REQUIRED_DOC_MARKERS) {
    if (!exposureDoc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing Phase 7 marker: ${marker}`);
    }
  }
  const phase7Start = exposureDoc?.indexOf("## Phase 7 — Remove Integration-Owned Selection") ?? -1;
  const phase7End =
    exposureDoc?.indexOf("## Denali and Telegram Compatibility Criteria", phase7Start) ?? -1;
  if (phase7Start >= 0 && phase7End > phase7Start) {
    const section = exposureDoc.slice(phase7Start, phase7End);
    if (/^- \[ \]/m.test(section)) {
      failures.push("Phase 7 closure checklist has unchecked items");
    }
  } else {
    failures.push("Phase 7 section boundaries not found in field-exposure-system.md");
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-7")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-7");
  }

  for (const path of [
    SCHEMA,
    POLICY_REPO,
    ROUTING_ONLY_SPEC,
    COLUMN_DROP_MIGRATION,
    DROP_DELIVERY_INTENTS_MIGRATION,
    SURFACE_META,
    WEB_TYPES,
    PHASE_7_CONTRACT,
    EXPOSURE_PAGE,
    EXPOSURE_INTENT_ROUTE,
    INTEGRATIONS_SERVICE,
    POLICY_ENGINE,
    DISPATCH,
  ]) {
    if (!existsSync(path)) {
      failures.push(`missing ${path.replace(`${REPO_ROOT}/`, "")}`);
    }
  }

  for (const relative of RETIRED_PATHS) {
    if (existsSync(join(REPO_ROOT, relative))) {
      failures.push(`7i: retired path must be deleted: ${relative}`);
    }
  }

  const schema = readText(SCHEMA);
  if (schema?.includes("model IntegrationDeliveryIntent")) {
    failures.push("7i: schema must not define IntegrationDeliveryIntent");
  }
  if (schema?.includes("integration_delivery_intents")) {
    failures.push("7i: schema must not reference integration_delivery_intents");
  }

  const dropMigration = readText(DROP_DELIVERY_INTENTS_MIGRATION);
  if (!dropMigration?.includes("DROP TABLE IF EXISTS integration_delivery_intents")) {
    failures.push("7i: drop migration must remove integration_delivery_intents");
  }

  const eventPolicyModel = schema?.match(/model IntegrationEventPolicy \{[\s\S]*?\n\}/)?.[0] ?? "";
  if (/selected_field_ids|selectedFieldIds|message_template|messageTemplate/.test(eventPolicyModel)) {
    failures.push("7e: IntegrationEventPolicy must be routing-only");
  }

  const surfaceMeta = readText(SURFACE_META);
  if (!surfaceMeta?.includes("buildExposureSelectableFieldCatalog")) {
    failures.push("7f: surface-meta must source catalog from exposure module");
  }
  if (surfaceMeta?.includes("deliveryCandidateFields")) {
    failures.push("7g: API surface-meta must not emit deliveryCandidateFields");
  }

  const webTypes = readText(WEB_TYPES);
  const webMetaType =
    webTypes?.match(/export type WorkspaceIntegrationSurfaceMetaResponse = \{[\s\S]*?\n\};/)?.[0] ??
    "";
  if (webMetaType.includes("deliveryCandidateFields")) {
    failures.push("7g: web meta response type must not declare deliveryCandidateFields");
  }

  const service = readText(INTEGRATIONS_SERVICE);
  if (!service?.includes("patchConnectionExposureIntent")) {
    failures.push("7h: integrations.service must save via patchConnectionExposureIntent");
  }
  if (service?.includes("mapIntegrationDeliveryIntentWriteToExposureIntent")) {
    failures.push("7i: integrations.service must not dual-write via legacy bridge");
  }

  const policyEngine = readText(POLICY_ENGINE);
  if (policyEngine?.includes("adaptIntegrationDeliveryIntentToExposureIntent")) {
    failures.push("7i: policy engine must not use legacy delivery intent adapter");
  }
  if (!policyEngine?.includes("exposureIntent:")) {
    failures.push("7i: policy engine decisions must expose exposureIntent");
  }

  const dispatch = readText(DISPATCH);
  if (!dispatch?.includes("resolveExposureDecision")) {
    failures.push("7i: dispatch must route selection through resolveExposureDecision");
  }
  if (dispatch?.includes("legacy_delivery_intent")) {
    failures.push("7i: dispatch must not reference legacy_delivery_intent");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-7-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-7-guard: PASS");
}

main();
