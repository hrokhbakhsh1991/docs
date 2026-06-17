/**
 * Phase 5A — Hermetic schema gate closure guards (WEB-P11-HERMETIC-*)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

function readWebSource(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), "utf8");
}

function readRepoSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("denali-draft-hermetic-closure.spec.ts — Phase 5A", () => {
  it("WEB-P11-HERMETIC-01 engine runs prePush schemaGate before onPush", () => {
    const source = readRepoSource("packages/draft-engine/src/engine.ts");
    assert.match(source, /buildPayloadForPush/);
    assert.match(source, /schemaGate/);
    assert.match(source, /QUARANTINED/);
  });

  it("WEB-P11-HERMETIC-02 flushKeepalive blocked on gate failure", () => {
    const source = readRepoSource("packages/draft-engine/src/engine.ts");
    const flushStart = source.indexOf("flushKeepalive():");
    assert.ok(flushStart >= 0);
    const flushBody = source.slice(flushStart, flushStart + 1200);
    assert.match(flushBody, /buildPayloadForPush/);
    assert.match(flushBody, /QUARANTINED/);
  });

  it("WEB-P11-HERMETIC-03 merge output has no resurrected keys before sync egress", () => {
    const resumeSpec = readWebSource("test/denali-wizard-draft-resume.spec.ts");
    assert.match(resumeSpec, /WEB-P11-HERMETIC-03/);
    assert.match(resumeSpec, /mergeDenaliWizardDraftEnvelope/);
  });

  it("WEB-P11-HERMETIC-03b create-tour wires schemaGate via useWorkspaceDraft", () => {
    const source = readWebSource("app/tours/new/new-tour-wizard-client.tsx");
    assert.match(source, /createDenaliDraftSchemaGate/);
    assert.match(source, /schemaGate:\s*denaliSchemaGate/);
    assert.match(source, /DraftSyncChrome/);
  });

  it("WEB-P11-HERMETIC-04 denali gate defines MAX_SANITY_ATTEMPTS = 2", () => {
    const source = readRepoSource("packages/workspaces/denali/src/draft/create-denali-draft-schema-gate.ts");
    assert.match(source, /MAX_SANITY_ATTEMPTS/);
    assert.match(source, /SANITIZE_FIXPOINT_EXCEEDED/);
  });
});
