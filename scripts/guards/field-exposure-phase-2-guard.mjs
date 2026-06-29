#!/usr/bin/env node
/**
 * Field Exposure System — Phase 2 read-path adapter closure guard.
 *
 * Phase 2 delivered the legacy→exposure mapper and adapter. Phase 7 retired the adapter;
 * this guard verifies the mapper remains and native exposure intent is the read path.
 *
 * @see docs/architecture/field-exposure-system.md#phase-2--read-path-adapter-closure
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const ADAPTER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/exposure/integration-delivery-intent-adapter.ts"
);
const MAPPER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/exposure/legacy-delivery-exposure-mapper.ts"
);
const PATCH_EXPOSURE = join(
  REPO_ROOT,
  "apps/api/src/exposure/patch-connection-exposure-intent.ts"
);
const POLICY_ENGINE_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/integration-policy-engine.ts"
);
const DISPATCH_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts"
);
const DISPATCH_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts"
);
const PHASE_2_CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-2-adapter.contract.spec.ts"
);

const REQUIRED_DOC_MARKERS = [
  "## Phase 2 — Read-Path Adapter Closure",
  "legacy-delivery-exposure-mapper.ts",
  "guard:field-exposure-phase-2",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const exposureDoc = readText(EXPOSURE_DOC);
  if (!exposureDoc?.includes("Phase 2 complete")) {
    failures.push("field-exposure-system.md must mark Phase 2 complete");
  }
  for (const marker of REQUIRED_DOC_MARKERS) {
    if (!exposureDoc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing Phase 2 marker: ${marker}`);
    }
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-2")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-2");
  }

  if (!existsSync(PHASE_2_CONTRACT)) {
    failures.push("missing field-exposure-phase-2-adapter.contract.spec.ts");
  }
  if (existsSync(ADAPTER_SOURCE)) {
    failures.push("Phase 7: integration-delivery-intent-adapter.ts must be deleted");
  }
  if (!existsSync(MAPPER_SOURCE)) {
    failures.push("missing legacy-delivery-exposure-mapper.ts shared mapper");
  }
  if (!existsSync(PATCH_EXPOSURE)) {
    failures.push("missing patch-connection-exposure-intent.ts native save path");
  }

  const policyEngine = readText(POLICY_ENGINE_SOURCE);
  if (!policyEngine?.includes("exposureIntentRepository")) {
    failures.push("policy engine must read native exposure intents");
  }
  if (policyEngine?.includes("adaptIntegrationDeliveryIntentToExposureIntent")) {
    failures.push("policy engine must not call legacy adapter after Phase 7");
  }

  const dispatch = readText(DISPATCH_SOURCE);
  if (!dispatch?.includes("resolveExposureDecision")) {
    failures.push("dispatch must route intent selection through resolveExposureDecision");
  }
  if (!dispatch?.includes("exposureIntent: decision.exposureIntent")) {
    failures.push("dispatch must pass exposureIntent into shadow metadata path");
  }

  const dispatchSpec = readText(DISPATCH_SPEC);
  if (!dispatchSpec?.includes("native_exposure_intent")) {
    failures.push("dispatch spec must assert native selection source");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-2-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-2-guard: PASS");
}

main();
