import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  parseDenaliWizardDraftRecord,
  serializeDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";

import { bootstrapDenaliEditFormFromDraft } from "./denaliEditDraftBootstrap";
import {
  denaliWizardTemplateDraftStorageKey,
  denaliWizardTourEditDraftStorageKey,
  isDenaliScopedDraftStorageKey,
} from "./denaliWizardDraftStorageKeys";
import { getDenaliWizardDraftVersionHash } from "./denaliWizardDraftVersion";

test("denaliWizardDraftStorageKeys scopes create drafts to template and edit drafts to tour", () => {
  assert.equal(
    denaliWizardTemplateDraftStorageKey("tpl-abc"),
    "tour-create-wizard-draft-v1:denali:template:tpl-abc",
  );
  assert.equal(
    denaliWizardTourEditDraftStorageKey("tour-xyz"),
    "tour-create-wizard-draft-v1:denali:tour:tour-xyz",
  );
  assert.equal(isDenaliScopedDraftStorageKey(denaliWizardTourEditDraftStorageKey("tour-xyz")), true);
  assert.equal(isDenaliScopedDraftStorageKey("tour-create-wizard-draft-v1:ws1"), false);
});

test("bootstrapDenaliEditFormFromDraft auto-restores compatible edit drafts", () => {
  const serverBaseline = buildDenaliTourCreateDefaultValues();
  serverBaseline.basicInfo.title = "From API";

  const draftForm = buildDenaliTourCreateDefaultValues();
  draftForm.basicInfo.title = "Unsaved edit draft";

  const parsed = parseDenaliWizardDraftRecord(serializeDenaliWizardDraft(draftForm, undefined));
  assert.ok(parsed);

  const result = bootstrapDenaliEditFormFromDraft({
    tourId: "tour-123",
    serverBaseline,
    readDraft: () => parsed,
  });

  assert.equal(result.restoredFromDraft, true);
  assert.equal(result.incompatibleDraft, null);
  assert.equal(result.initialValues.basicInfo.title, "Unsaved edit draft");
});

test("bootstrapDenaliEditFormFromDraft keeps server baseline for incompatible drafts", () => {
  const serverBaseline = buildDenaliTourCreateDefaultValues();
  serverBaseline.basicInfo.title = "From API";

  const parsed = parseDenaliWizardDraftRecord(
    JSON.stringify({
      _wizardRail: "denali",
      versionHash: "stale-hash",
      basicInfo: { title: "Old incompatible draft" },
    }),
  );
  assert.ok(parsed);

  const result = bootstrapDenaliEditFormFromDraft({
    tourId: "tour-123",
    serverBaseline,
    readDraft: () => parsed,
  });

  assert.equal(result.restoredFromDraft, false);
  assert.ok(result.incompatibleDraft);
  assert.equal(result.initialValues.basicInfo.title, "From API");
  assert.notEqual(getDenaliWizardDraftVersionHash(), "stale-hash");
});
