/**
 * Phase 5B — Draft sync chrome symmetry (WEB-P11-SYMM-*)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readWebSource(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), "utf8");
}

describe("denali-flat-edit-sync-chrome.spec.ts — Phase 5B", () => {
  it("WEB-P11-SYMM-01 flat-edit binds DraftSyncChrome with manual sync and soft-lock", () => {
    const flatEditChrome = readWebSource("src/wizard/flat-edit-chrome.tsx");
    const chrome = readWebSource("src/draft/draft-sync-chrome.tsx");
    assert.match(flatEditChrome, /DraftSyncChrome/);
    assert.match(flatEditChrome, /showInlineSoftLockBanner/);
    assert.match(flatEditChrome, /TOUR_EDIT_TEST_IDS\.draftSync/);
    assert.match(chrome, /DraftManualSyncButton/);
    assert.match(chrome, /DraftSyncSoftLockBanner/);
  });

  it("WEB-P11-SYMM-02 create-tour and flat-edit both consume DraftSyncChrome", () => {
    const createChrome = readWebSource("src/wizard/create-tour-wizard-chrome.tsx");
    const flatEditChrome = readWebSource("src/wizard/flat-edit-chrome.tsx");
    assert.match(createChrome, /DraftSyncChrome/);
    assert.match(flatEditChrome, /DraftSyncChrome/);
    assert.doesNotMatch(createChrome, /from "@\/draft\/draft-sync-indicator"/);
    assert.doesNotMatch(flatEditChrome, /from "@\/draft\/draft-sync-indicator"/);
  });

  it("WEB-P11-SYMM-03 flat-edit passes navLocked to OperatorFlatEditForm fieldset", () => {
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/flat-edit-page-client.tsx");
    const formShim = readWebSource("src/wizard/flat-edit-form-shell.tsx");
    const form = readFileSync(
      join(WEB_ROOT, "..", "..", "packages/workspaces/denali/src/ui/chrome/denali-flat-edit-form.tsx"),
      "utf8"
    );
    assert.match(flatEdit, /navLocked=\{readyCore\.draftSync\.navLocked\}/);
    assert.match(formShim, /workspace-wizard-flat-edit-form-bindings\.generated/);
    assert.match(form, /fieldset disabled=\{navLocked\}/);
  });

  it("WEB-P11-SYMM-04 flat-edit wires schemaGate like create-tour", () => {
    const flatEditHook = readWebSource("src/wizard/use-flat-edit-page.ts");
    assert.match(flatEditHook, /createOperatorDraftSchemaGate/);
    assert.match(flatEditHook, /schemaGate:\s*draftSchemaGate/);
  });

  it("WEB-P11-SYMM-05 flat-edit passes conflictReloadNotice like create-tour (Track C)", () => {
    const createChrome = readWebSource("src/wizard/create-tour-wizard-chrome.tsx");
    const flatEditChrome = readWebSource("src/wizard/flat-edit-chrome.tsx");
    assert.match(createChrome, /conflictReloadNotice=\{props\.draftSync\.conflictReloadNotice\}/);
    assert.match(flatEditChrome, /conflictReloadNotice=\{props\.draftSync\.conflictReloadNotice\}/);
  });
});
