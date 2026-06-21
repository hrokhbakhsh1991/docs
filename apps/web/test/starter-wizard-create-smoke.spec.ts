/**
 * Phase 14.3 — starter create orchestrator smoke
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

const ORCHESTRATOR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/wizard/workspace-create-tour-wizard-client.tsx"
);

describe("starter-wizard-create-smoke.spec.ts (P14-3-T08)", () => {
  it("P14-3-08a orchestrator file exists without denali catalog import", () => {
    const source = readFileSync(ORCHESTRATOR, "utf8");
    assert.doesNotMatch(source, /denali-catalog-sanitize/);
    assert.match(source, /WorkspaceCreateTourWizardClient/);
  });

  it("P14-3-08b starter plugin exposes prepareSubmitPayload", () => {
    const plugin = getStarterWorkspacePlugin();
    assert.equal(typeof plugin.wizardHost?.prepareSubmitPayload, "function");
  });

  it("P14-3-09 orchestrator wires platform draft sync", () => {
    const source = readFileSync(ORCHESTRATOR, "utf8");
    assert.match(source, /useWorkspaceDraft/);
    assert.match(source, /DraftSyncChrome/);
    assert.match(source, /platformCreateTourDraftKey/);
    assert.match(source, /draftSyncStatus=\{draftSync\.status\}/);
  });
});
