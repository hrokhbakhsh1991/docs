#!/usr/bin/env node
/**
 * Field Exposure System — Phase 6 dual-write + controlled cutover closure guard.
 *
 * Phase 6 introduced native mirror + cutover flag. Phase 7 retired legacy delivery intents;
 * this guard verifies the historical Phase 6 contract markers remain documented and that
 * cutover observability still records selection decisions on native-only paths.
 *
 * @see docs/architecture/field-exposure-system.md#phase-6--dual-write--controlled-cutover
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const RUNTIME_MODE = join(REPO_ROOT, "apps/api/src/exposure/exposure-runtime-mode.ts");
const RUNTIME_MODE_SPEC = join(REPO_ROOT, "apps/api/src/exposure/exposure-runtime-mode.spec.ts");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts"
);
const DISPATCH_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts"
);
const PATCH_EXPOSURE_INTENT = join(
  REPO_ROOT,
  "apps/api/src/exposure/patch-connection-exposure-intent.ts"
);
const INTEGRATIONS_SERVICE = join(
  REPO_ROOT,
  "apps/api/src/integrations/http/integrations.service.ts"
);
const PHASE_6_CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-6-cutover.contract.spec.ts"
);
const METRICS_SOURCE = join(REPO_ROOT, "apps/api/src/observability/metrics.ts");
const FORMATTER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/format-integration-delivery-message.ts"
);
const WORKER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/worker/process-integration-delivery-once.ts"
);

const REQUIRED_DOC_MARKERS = [
  "## Phase 6 — Dual-Write + Controlled Cutover",
  "FIELD_EXPOSURE_RUNTIME_MODE",
  "selectionSource",
  "nativeIntentMissing",
  "field_exposure_cutover_selection_total",
  "guard:field-exposure-phase-6",
  "field-exposure-phase-6-cutover.contract.spec.ts",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const exposureDoc = readText(EXPOSURE_DOC);
  if (!exposureDoc?.includes("Phase 6 complete")) {
    failures.push("field-exposure-system.md must mark Phase 6 complete");
  }
  for (const marker of REQUIRED_DOC_MARKERS) {
    if (!exposureDoc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing Phase 6 marker: ${marker}`);
    }
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-6")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-6");
  }

  for (const path of [
    RUNTIME_MODE,
    RUNTIME_MODE_SPEC,
    DISPATCH,
    DISPATCH_SPEC,
    PATCH_EXPOSURE_INTENT,
    INTEGRATIONS_SERVICE,
    PHASE_6_CONTRACT,
  ]) {
    if (!existsSync(path)) {
      failures.push(`missing ${path.replace(`${REPO_ROOT}/`, "")}`);
    }
  }

  const runtime = readText(RUNTIME_MODE);
  for (const token of [
    "FieldExposureSelectionSource",
    "native_exposure_intent",
    "exposure_profile_defaults",
    "nativeIntentMissing",
  ]) {
    if (!runtime?.includes(token)) {
      failures.push(`exposure-runtime-mode.ts must define decision-source token: ${token}`);
    }
  }

  const dispatch = readText(DISPATCH);
  if (!dispatch?.includes("resolveExposureDecision")) {
    failures.push("dispatch must route field selection through resolveExposureDecision");
  }
  if (!dispatch?.includes("fieldExposureDecision")) {
    failures.push("dispatch must attach fieldExposureDecision audit metadata");
  }
  if (!dispatch?.includes("fieldExposureRuntimeMetadata(runtimeMode, {")) {
    failures.push("dispatch must build per-decision runtime metadata");
  }
  if (!dispatch?.includes("recordFieldExposureCutoverSelection")) {
    failures.push("dispatch must record cutover selection observability in cutover mode");
  }

  const metrics = readText(METRICS_SOURCE);
  if (!metrics?.includes("field_exposure_cutover_selection_total")) {
    failures.push("metrics must define field_exposure_cutover_selection_total");
  }

  const formatter = readText(FORMATTER_SOURCE);
  if (formatter?.includes("fieldExposureRuntime")) {
    failures.push("formatter must not read fieldExposureRuntime");
  }
  const worker = readText(WORKER_SOURCE);
  if (worker?.includes("fieldExposureRuntime")) {
    failures.push("worker must not read fieldExposureRuntime");
  }

  const service = readText(INTEGRATIONS_SERVICE);
  if (!service?.includes("patchConnectionExposureIntent")) {
    failures.push("integrations.service must persist native exposure intents on save");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-6-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-6-guard: PASS");
}

main();
