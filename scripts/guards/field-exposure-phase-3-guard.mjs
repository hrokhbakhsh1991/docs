#!/usr/bin/env node
/**
 * Field Exposure System — Phase 3 shadow resolver closure guard.
 *
 * @see docs/architecture/field-exposure-system.md#phase-3--shadow-resolver-closure
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const SHADOW_RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/shadow-exposure-resolver.ts");
const SHADOW_RENDERED = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-rendered-delivery-parity.ts"
);
const SHADOW_DELIVERY_PARITY = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-delivery-field-parity.ts"
);
const SHADOW_EXPOSURE_PARITY = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-exposure-parity.ts"
);
const SHADOW_EXPOSURE_PARITY_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-exposure-parity.spec.ts"
);
const METRICS_SPEC = join(REPO_ROOT, "apps/api/src/observability/metrics.spec.ts");
const SHADOW_RESOLVER_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-exposure-resolver.spec.ts"
);
const SHADOW_RENDERED_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-rendered-delivery-parity.spec.ts"
);
const SHADOW_DELIVERY_PARITY_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-delivery-field-parity.spec.ts"
);
const FORMATTER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/format-integration-delivery-message.ts"
);
const FORMATTER_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/format-integration-delivery-message.spec.ts"
);
const METRICS_SOURCE = join(REPO_ROOT, "apps/api/src/observability/metrics.ts");
const PROVIDERS_DIR = join(REPO_ROOT, "apps/api/src/integrations/providers");
const DISPATCH_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts"
);
const DISPATCH_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts"
);
const WORKER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/worker/process-integration-delivery-once.ts"
);
const PHASE_3_CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-3-shadow.contract.spec.ts"
);

const REQUIRED_DOC_MARKERS = [
  "## Phase 3 — Shadow Resolver Closure",
  "deliveryParity",
  "renderedMessage",
  "renderedParity",
  "field_exposure_shadow_parity_mismatch_total",
  "guard:field-exposure-phase-3",
  "field-exposure-phase-3-shadow.contract.spec.ts",
];

const REQUIRED_SHADOW_MARKERS = [
  "resolveShadowExposureFromDelivery",
  "resolveShadowRenderedDeliveryParity",
  "resolveShadowDeliveryFieldParity",
  "resolveShadowExposureParity",
  "deliveryParity",
  "renderedMessage",
  "renderedParity",
  "parity",
  "authoritativeDeliveryFields",
  "LEGACY_DELIVERY_SHADOW_EXPOSURE_RESOLVER",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function listProviderSources() {
  const files = [];
  for (const entry of readdirSync(PROVIDERS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const nested of readdirSync(join(PROVIDERS_DIR, entry.name), {
        withFileTypes: true,
      })) {
        if (nested.isFile() && nested.name.endsWith(".ts") && !nested.name.endsWith(".spec.ts")) {
          files.push(join(PROVIDERS_DIR, entry.name, nested.name));
        }
      }
    }
  }
  return files;
}

function main() {
  const failures = [];

  const exposureDoc = readText(EXPOSURE_DOC);
  if (!exposureDoc?.includes("Phase 3 complete")) {
    failures.push("field-exposure-system.md must mark Phase 3 complete");
  }
  for (const marker of REQUIRED_DOC_MARKERS) {
    if (!exposureDoc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing Phase 3 marker: ${marker}`);
    }
  }
  const phase3Start = exposureDoc?.indexOf("## Phase 3 — Shadow Resolver Closure") ?? -1;
  const phase3End =
    exposureDoc?.indexOf("## Phase 4 — Exposure Profile Default Source Closure", phase3Start) ?? -1;
  if (phase3Start >= 0 && phase3End > phase3Start) {
    const phase3Section = exposureDoc.slice(phase3Start, phase3End);
    if (/^- \[ \]/m.test(phase3Section)) {
      failures.push("Phase 3 checklist has unchecked items");
    }
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-3")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-3");
  }

  if (!existsSync(PHASE_3_CONTRACT)) {
    failures.push("missing field-exposure-phase-3-shadow.contract.spec.ts");
  }
  for (const path of [
    SHADOW_RENDERED,
    SHADOW_DELIVERY_PARITY,
    SHADOW_EXPOSURE_PARITY,
    SHADOW_RENDERED_SPEC,
    SHADOW_DELIVERY_PARITY_SPEC,
    SHADOW_EXPOSURE_PARITY_SPEC,
    SHADOW_RESOLVER_SPEC,
  ]) {
    if (!existsSync(path)) {
      failures.push(`missing ${path.replace(`${REPO_ROOT}/`, "")}`);
    }
  }

  const shadowResolver = readText(SHADOW_RESOLVER);
  for (const marker of REQUIRED_SHADOW_MARKERS) {
    if (!shadowResolver?.includes(marker)) {
      failures.push(`shadow-exposure-resolver.ts missing: ${marker}`);
    }
  }

  const dispatch = readText(DISPATCH_SOURCE);
  if (!dispatch?.includes("fieldExposureShadow")) {
    failures.push("dispatch must attach fieldExposureShadow metadata");
  }
  if (!dispatch?.includes("authoritativeDeliveryFields")) {
    failures.push("dispatch must pass authoritativeDeliveryFields into shadow resolver");
  }
  if (!dispatch?.includes("recordFieldExposureShadowParityMismatch")) {
    failures.push("dispatch must record shadow parity mismatch observability");
  }

  const dispatchSpec = readText(DISPATCH_SPEC);
  if (!dispatchSpec?.includes("fieldExposureShadow.renderedMessage")) {
    failures.push("dispatch spec must assert shadow renderedMessage parity");
  }
  if (!dispatchSpec?.includes("fieldExposureShadow.parity.matches")) {
    failures.push("dispatch spec must assert shadow aggregate parity");
  }
  if (!dispatchSpec?.includes("recordFieldExposureShadowParityMismatch")) {
    failures.push("dispatch spec must reference shadow parity mismatch recorder wiring");
  }

  const metricsSpec = readText(METRICS_SPEC);
  if (!metricsSpec?.includes("recordFieldExposureShadowParityMismatch")) {
    failures.push("metrics spec must cover shadow parity mismatch recorder");
  }

  const formatter = readText(FORMATTER_SOURCE);
  if (formatter?.includes("fieldExposureShadow")) {
    failures.push("formatter must not consume fieldExposureShadow during Phase 3");
  }

  const formatterSpec = readText(FORMATTER_SPEC);
  if (!formatterSpec?.includes("ignores fieldExposureShadow metadata")) {
    failures.push("formatter spec must prove fieldExposureShadow is ignored");
  }

  for (const providerPath of listProviderSources()) {
    const providerSource = readText(providerPath);
    if (providerSource?.includes("fieldExposureShadow")) {
      failures.push(`provider must not consume fieldExposureShadow: ${providerPath}`);
    }
  }

  const metrics = readText(METRICS_SOURCE);
  if (!metrics?.includes("recordFieldExposureShadowParityMismatch")) {
    failures.push("metrics must expose field exposure shadow parity mismatch recorder");
  }
  if (!metrics?.includes("field_exposure_shadow_parity_mismatch_total")) {
    failures.push("metrics must define field_exposure_shadow_parity_mismatch_total");
  }

  const worker = readText(WORKER_SOURCE);
  if (worker?.includes("fieldExposureShadow")) {
    failures.push("worker must not consume fieldExposureShadow during Phase 3");
  }
  if (!worker?.includes("formatIntegrationDeliveryMessage")) {
    failures.push("worker must format delivery via integrationDelivery fields");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-3-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-3-guard: PASS");
}

main();
