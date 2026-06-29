import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-3-guard.mjs");
const SHADOW_RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/shadow-exposure-resolver.ts");
const SHADOW_RENDERED = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-rendered-delivery-parity.ts"
);
const SHADOW_DELIVERY_PARITY = join(
  REPO_ROOT,
  "apps/api/src/exposure/shadow-delivery-field-parity.ts"
);
const DISPATCH_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts"
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
const WORKER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/worker/process-integration-delivery-once.ts"
);

function listProviderSources(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(PROVIDERS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const nested of readdirSync(join(PROVIDERS_DIR, entry.name), {
      withFileTypes: true,
    })) {
      if (nested.isFile() && nested.name.endsWith(".ts") && !nested.name.endsWith(".spec.ts")) {
        files.push(join(PROVIDERS_DIR, entry.name, nested.name));
      }
    }
  }
  return files;
}

describe("field exposure phase 3 shadow contract", () => {
  it("architecture doc marks Phase 3 complete with shadow closure section", () => {
    assert.equal(existsSync(EXPOSURE_DOC), true);
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 3 complete/i);
    assert.match(text, /## Phase 3 — Shadow Resolver Closure/);
    assert.match(text, /guard:field-exposure-phase-3/);
    assert.match(text, /deliveryParity/);
    assert.match(text, /field_exposure_shadow_parity_mismatch_total/);
  });

  it("shadow resolver records delivery, rendered, and aggregate parity metadata", () => {
    const shadowResolver = readFileSync(SHADOW_RESOLVER, "utf8");
    assert.match(shadowResolver, /deliveryParity/);
    assert.match(shadowResolver, /renderedMessage/);
    assert.match(shadowResolver, /renderedParity/);
    assert.match(shadowResolver, /parity/);
    assert.match(shadowResolver, /authoritativeDeliveryFields/);

    const renderedParity = readFileSync(SHADOW_RENDERED, "utf8");
    assert.match(renderedParity, /authoritativeFields/);
    assert.match(readFileSync(SHADOW_DELIVERY_PARITY, "utf8"), /resolveShadowDeliveryFieldParity/);
  });

  it("dispatch attaches shadow metadata and records mismatch observability", () => {
    const dispatch = readFileSync(DISPATCH_SOURCE, "utf8");
    assert.match(dispatch, /fieldExposureShadow/);
    assert.match(dispatch, /authoritativeDeliveryFields/);
    assert.match(dispatch, /recordFieldExposureShadowParityMismatch/);
    assert.match(readFileSync(METRICS_SOURCE, "utf8"), /field_exposure_shadow_parity_mismatch_total/);
  });

  it("formatter and providers continue to ignore fieldExposureShadow", () => {
    const formatter = readFileSync(FORMATTER_SOURCE, "utf8");
    assert.doesNotMatch(formatter, /fieldExposureShadow/);
    assert.match(
      readFileSync(FORMATTER_SPEC, "utf8"),
      /ignores fieldExposureShadow metadata/,
    );

    for (const providerPath of listProviderSources()) {
      assert.doesNotMatch(readFileSync(providerPath, "utf8"), /fieldExposureShadow/);
    }

    const worker = readFileSync(WORKER_SOURCE, "utf8");
    assert.match(worker, /formatIntegrationDeliveryMessage/);
    assert.doesNotMatch(worker, /fieldExposureShadow/);
  });

  it("phase 3 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || "guard failed");
  });
});
