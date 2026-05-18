import assert from "node:assert/strict";
import test from "node:test";

import type { WorkspaceTourWizardDraftRecord } from "@/lib/settings-tour-wizard-draft.client";

import { pickWizardDraftForRestore } from "./pick-wizard-draft-for-restore";
import type { ParsedWizardDraft } from "./tourWizardDraftEnvelope";

function localDraft(savedAt: string): ParsedWizardDraft {
  return {
    formPatch: { overview: { title: "local title twelve" } },
    wizardMeta: {
      resolvedFormProfile: "general",
      formProfileVersion: 1,
      savedAt,
    },
  };
}

function serverDraft(updatedAt: string, title: string): WorkspaceTourWizardDraftRecord {
  return {
    id: "d1",
    workspaceId: "w1",
    userId: "u1",
    envelope: {
      overview: { title },
      _wizardMeta: { resolvedFormProfile: "general", formProfileVersion: 1 },
    },
    wizardContractVersion: 1,
    rowVersion: 2,
    updatedAt,
  };
}

test("prefers server when server updatedAt is newer than local savedAt", () => {
  const pick = pickWizardDraftForRestore(
    localDraft("2026-05-17T10:00:00.000Z"),
    serverDraft("2026-05-17T12:00:00.000Z", "server title twelve"),
  );
  assert.ok(pick);
  assert.equal(pick.source, "server");
  assert.equal(pick.rowVersion, 2);
  assert.equal(pick.parsed.formPatch.overview?.title, "server title twelve");
});

test("prefers local when local savedAt is newer", () => {
  const pick = pickWizardDraftForRestore(
    localDraft("2026-05-17T14:00:00.000Z"),
    serverDraft("2026-05-17T12:00:00.000Z", "server title twelve"),
  );
  assert.ok(pick);
  assert.equal(pick.source, "local");
  assert.equal(pick.parsed.formPatch.overview?.title, "local title twelve");
});

test("uses server when local is absent", () => {
  const pick = pickWizardDraftForRestore(
    null,
    serverDraft("2026-05-17T12:00:00.000Z", "only server twelve"),
  );
  assert.ok(pick);
  assert.equal(pick.source, "server");
});
