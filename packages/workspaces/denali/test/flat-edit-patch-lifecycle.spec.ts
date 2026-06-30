import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDenaliWorkspacePlugin } from "../src/denali.plugin";
import { runDenaliFlatEditPatch } from "../src/ui/chrome/flat-edit-patch-logic";
import { emptyDenaliTourWizardDraft } from "../src/draft/denali-tour-wizard-draft";

describe("flat-edit-patch-lifecycle.spec.ts — Phase 12.4", () => {
  it("DEN-12.4-LC-01 rejects unpublish when lifecycle disallows OPEN→DRAFT", async () => {
    const plugin = createDenaliWorkspacePlugin();
    const outcome = await runDenaliFlatEditPatch({
      plugin,
      draft: emptyDenaliTourWizardDraft(),
      denaliRules: {} as never,
      wizardRuleEvalContext: undefined,
      tenantId: "tenant-a",
      rowVersion: 1,
      patchIntent: "unpublish",
      gate: { templateSteps: [] },
      loadCatalog: async () => ({
        activeEquipmentIds: [],
        activeThemeIds: [],
        activeGuideLanguageIds: [],
        selectableLeaderIds: [],
        activeDestinationIds: [],
      }),
      updateTour: async () => ({ ok: true, rowVersion: 2 }),
    });

    assert.equal(outcome.ok, false);
    if (outcome.ok) {
      return;
    }
    assert.equal(outcome.failure.kind, "update-action");
    assert.equal(outcome.failure.code, "TOUR_LIFECYCLE_TRANSITION_REJECTED:OPEN->DRAFT");
  });
});
