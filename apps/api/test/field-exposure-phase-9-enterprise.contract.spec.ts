import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-9-guard.mjs");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);
const MODULE_ACCESS = join(
  REPO_ROOT,
  "apps/api/src/settings/settings-exposure-module-access.ts",
);
const API_PACKAGE = join(REPO_ROOT, "apps/api/package.json");

describe("field exposure phase 9 enterprise runtime safety contract (M2)", () => {
  it("documents M2 governance and fail-closed dispatch contract", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /## Enterprise Closure — Milestone M2 \(Runtime Safe\)/);
    assert.match(text, /### Phase 9\.10 — Fail-closed dispatch \(M2 blocker\)/);
    assert.match(text, /Phase 9\.7 — Playwright exposure settings/);
    assert.match(text, /guard:field-exposure-phase-9/);
    assert.match(text, /field-exposure-phase-9-enterprise\.contract\.spec\.ts/);
  });

  it("wires fail-closed env and selector failure handling in dispatch", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    assert.match(dispatch, /FIELD_EXPOSURE_ENGINE_FAIL_CLOSED/);
    assert.match(dispatch, /engineSelectorMissing/);
    assert.match(dispatch, /recordFieldExposureEngineSelectorFailure/);
  });

  it("defines exposure settings module access gate", () => {
    const source = readFileSync(MODULE_ACCESS, "utf8");
    assert.match(source, /export async function assertWorkspaceExposureModuleAccess/);
    assert.match(source, /SettingsMutationForbiddenError/);
  });

  it("registers test:exposure:integration script for Postgres integration pack", () => {
    const pkg = readFileSync(API_PACKAGE, "utf8");
    assert.match(pkg, /test:exposure:integration/);
    assert.match(pkg, /field-exposure-\*\.spec\.ts/);
  });

  it("runs field-exposure-phase-9-guard successfully", () => {
    assert.ok(existsSync(GUARD_SCRIPT));
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "field-exposure-phase-9-guard failed",
    );
  });
});
