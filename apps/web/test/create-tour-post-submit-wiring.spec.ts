/**
 * Phase 11.6 — post-create redirect + remote draft discard wiring (WEB-P11-6-06)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "../..");
const DENALI_CORE = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/ui/chrome/use-create-tour-wizard-core.ts"
);

function readWeb(rel: string): string {
  return readFileSync(join(WEB_ROOT, rel), "utf8");
}

describe("create-tour-post-submit-wiring.spec.ts", () => {
  it("WEB-P11-6-06 denali shell wires post-submit helper with remote discard", () => {
    const hook = readWeb("src/wizard/use-denali-create-tour-wizard.ts");
    assert.match(hook, /runCreateTourPostSubmitSuccess/);
    assert.match(hook, /discardRemoteDraft/);
    assert.match(hook, /createCreateTourPostSubmitDiscardRemoteDraft/);
    assert.match(hook, /onCreateSuccess/);
    assert.doesNotMatch(hook, /discardRemoteDraft:[\s\S]*draftSync\.clearDraft/);
  });

  it("WEB-P11-6-07 workspace orchestrator matches denali post-submit contract", () => {
    const client = readWeb("src/wizard/workspace-create-tour-wizard-client.tsx");
    assert.match(client, /runCreateTourPostSubmitSuccess/);
    assert.match(client, /createCreateTourPostSubmitDiscardRemoteDraft/);
    assert.doesNotMatch(client, /createCompleted/);
  });

  it("WEB-P11-6-08 denali core delegates cleanup to onCreateSuccess only", () => {
    const core = readFileSync(DENALI_CORE, "utf8");
    assert.match(core, /input\.onCreateSuccess\?\.\(result\.record\.id\)/);
    assert.doesNotMatch(core, /createCompleted/);
    assert.doesNotMatch(core, /draftSync\.clearDraft/);
  });
});
