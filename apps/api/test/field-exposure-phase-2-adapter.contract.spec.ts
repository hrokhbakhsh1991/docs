import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-2-guard.mjs");
const MAPPER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/exposure/legacy-delivery-exposure-mapper.ts"
);
const PATCH_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/exposure/patch-connection-exposure-intent.ts"
);
const DISPATCH_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts"
);

describe("field exposure phase 2 adapter contract", () => {
  it("architecture doc marks Phase 2 complete with adapter closure section", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 2 complete/i);
    assert.match(text, /## Phase 2 — Read-Path Adapter Closure/);
    assert.match(text, /guard:field-exposure-phase-2/);
    assert.match(text, /legacy-delivery-exposure-mapper\.ts/);
  });

  it("legacy mapper and native patch path remain after adapter retirement", () => {
    assert.equal(existsSync(MAPPER_SOURCE), true);
    assert.equal(existsSync(PATCH_SOURCE), true);
    const patch = readFileSync(PATCH_SOURCE, "utf8");
    assert.match(patch, /resolveLegacyDeliveryExposureProfile/);
    assert.match(patch, /mapLegacyDeliveryIntentFields/);
  });

  it("dispatch routes field selection through native exposure intent", () => {
    const dispatch = readFileSync(DISPATCH_SOURCE, "utf8");
    assert.match(dispatch, /resolveExposureDecision/);
    assert.match(dispatch, /exposureIntent: decision\.exposureIntent/);
    assert.match(dispatch, /resolveActiveDeliveryFieldIds/);
  });

  it("phase 2 guard passes on repository closure state", () => {
    const result = spawnSync("node", [GUARD_SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout || "guard failed");
  });
});
