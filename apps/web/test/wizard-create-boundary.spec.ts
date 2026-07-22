import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROUTER_PATH = join(import.meta.dirname, "../app/tours/new/new-tour-wizard-client.tsx");

describe("wizard-create-boundary.spec.ts (P13-6)", () => {
  it("WEB-13.6-02 new-tour-wizard-client is thin router", () => {
    const source = readFileSync(ROUTER_PATH, "utf8");
    assert.ok(source.split("\n").length < 120);
    assert.doesNotMatch(source, /useWorkspaceDraft/);
    assert.doesNotMatch(source, /getDenaliWorkspacePlugin/);
    assert.match(source, /OperatorCreateTourWizardClient/);
    assert.match(source, /WorkspaceCreateTourWizardShell/);
  });
});
