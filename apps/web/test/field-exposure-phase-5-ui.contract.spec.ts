import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-5-guard.mjs");
const CHECKLIST = join(REPO_ROOT, "apps/web/src/exposure/ExposureFieldChecklist.tsx");
const SELECTION_LOGIC = join(REPO_ROOT, "apps/web/src/exposure/exposure-field-selection.ts");
const PANEL = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx",
);

describe("field exposure phase 5 ui contract", () => {
  it("architecture doc marks Phase 5 complete with generic UI section", () => {
    assert.equal(existsSync(EXPOSURE_DOC), true);
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 5 complete/i);
    assert.match(text, /## Phase 5 — Generic Exposure UI/);
    assert.match(text, /guard:field-exposure-phase-5/);
    assert.match(text, /field-exposure-phase-5-ui\.contract\.spec\.ts/);
  });

  it("exposure web module owns checklist and pure selection logic", () => {
    const checklist = readFileSync(CHECKLIST, "utf8");
    assert.match(checklist, /export function ExposureFieldChecklist/);
    assert.doesNotMatch(checklist, /@\/integrations/);

    const logic = readFileSync(SELECTION_LOGIC, "utf8");
    assert.match(logic, /resolveExposureChecklistContext/);
    assert.match(logic, /toExposureChecklistFields/);
    assert.match(logic, /resolveExposureFieldSelectionFromPersisted/);
    assert.doesNotMatch(logic, /from\s+["']react["']/);
  });

  it("integration panel embeds exposure UI through props only", () => {
    const panel = readFileSync(PANEL, "utf8");
    assert.match(panel, /ExposureFieldChecklist/);
    assert.match(panel, /resolveExposureIntentPatchInput/);
    assert.match(panel, /resolveExposureIntentContextFromPersisted/);
    assert.match(panel, /INTEGRATION_DELIVERY_POLICY_TEST_IDS\.surface/);
    assert.doesNotMatch(panel, /deliveryCandidateFields/);
    assert.doesNotMatch(panel, /context=\{\{\s*surface:\s*"telegram"/);
  });

  it("phase 5 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || "guard failed");
  });
});
