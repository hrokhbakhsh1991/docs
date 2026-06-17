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
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    const chrome = readWebSource("src/draft/draft-sync-chrome.tsx");
    assert.match(flatEdit, /DraftSyncChrome/);
    assert.match(flatEdit, /showInlineSoftLockBanner/);
    assert.match(flatEdit, /TOUR_EDIT_TEST_IDS\.draftSync/);
    assert.match(chrome, /DraftManualSyncButton/);
    assert.match(chrome, /DraftSyncSoftLockBanner/);
  });

  it("WEB-P11-SYMM-02 create-tour and flat-edit both consume DraftSyncChrome", () => {
    const createTour = readWebSource("app/tours/new/new-tour-wizard-client.tsx");
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    assert.match(createTour, /DraftSyncChrome/);
    assert.match(flatEdit, /DraftSyncChrome/);
    assert.doesNotMatch(createTour, /from "@\/draft\/draft-sync-indicator"/);
    assert.doesNotMatch(flatEdit, /from "@\/draft\/draft-sync-indicator"/);
  });

  it("WEB-P11-SYMM-03 flat-edit passes navLocked to DenaliFlatEditForm fieldset", () => {
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    const form = readWebSource("src/wizard/denali/denali-flat-edit-form.tsx");
    assert.match(flatEdit, /navLocked=\{draftSync\.navLocked\}/);
    assert.match(form, /fieldset disabled=\{navLocked\}/);
  });

  it("WEB-P11-SYMM-04 flat-edit wires schemaGate like create-tour", () => {
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    assert.match(flatEdit, /createDenaliDraftSchemaGate/);
    assert.match(flatEdit, /schemaGate:\s*denaliSchemaGate/);
  });

  it("WEB-P11-SYMM-05 flat-edit passes conflictReloadNotice like create-tour (Track C)", () => {
    const createTour = readWebSource("app/tours/new/new-tour-wizard-client.tsx");
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    assert.match(createTour, /conflictReloadNotice=\{draftSync\.conflictReloadNotice\}/);
    assert.match(flatEdit, /conflictReloadNotice=\{draftSync\.conflictReloadNotice\}/);
  });
});
