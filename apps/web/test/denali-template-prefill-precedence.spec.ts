import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { buildDenaliCreatePrefilledForm } from "@app-tour/workspace-denali/host/ui/chrome/draft-binding";
import { getCanonicalValue } from "@app-tour/workspace-denali/host/draft/tour-wizard";
import {
  DENALI_DEFAULT_FITNESS_LEVEL,
  DENALI_DEFAULT_TOUR_KIND,
} from "@app-tour/workspace-denali/host/ui/logic/denali-default-tour-kind";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";

import { ensureWizardTemplateFieldOverlaysAugment } from "../src/bootstrap/workspace-wizard-template-gate-bindings.generated";
import { buildExtendedWizardTemplateFieldOverlays } from "../src/tours/wizard-template-gate-logic";
import { applyWizardTemplatePrefillToDraft } from "../src/tours/wizard-template-prefill-logic";

describe("denali template prefill precedence (WEB-WIZ-010)", () => {
  before(async () => {
    await ensureWizardTemplateFieldOverlaysAugment("denali");
  });
  it("template category and fitness beat bootstrap fallback", () => {
    const denali = getDenaliWorkspacePlugin();
    const overlays = buildExtendedWizardTemplateFieldOverlays([
      {
        stepId: "denali_basic",
        label: "Basic",
        enabled: true,
        fields: [
          { canonicalPath: "category", defaultValue: "nature_day" },
          { canonicalPath: "participants.fitnessLevel", defaultValue: "high" },
        ],
      },
    ]);
    const gate = { seedLabel: "", fieldOverlays: overlays };
    const result = buildDenaliCreatePrefilledForm(gate, (draft, prefillGate) =>
      applyWizardTemplatePrefillToDraft(
        draft,
        prefillGate.seedLabel,
        prefillGate.fieldOverlays,
        "denali",
        denali
      )
    );
    assert.equal(getCanonicalValue(result, "category"), "nature_day");
    assert.equal(getCanonicalValue(result, "participants.fitnessLevel"), "high");
  });

  it("bootstrap fills only when template left paths empty", () => {
    const gate = { seedLabel: "", fieldOverlays: new Map() };
    const result = buildDenaliCreatePrefilledForm(gate, (draft) => draft);
    assert.equal(getCanonicalValue(result, "category"), DENALI_DEFAULT_TOUR_KIND);
    assert.equal(getCanonicalValue(result, "participants.fitnessLevel"), DENALI_DEFAULT_FITNESS_LEVEL);
  });

  it("WEB-WIZ-013 hidden composite child default beats bootstrap fitness fallback", () => {
    const denali = getDenaliWorkspacePlugin();
    const overlays = buildExtendedWizardTemplateFieldOverlays([
      {
        stepId: "denali_pricing",
        label: "Pricing",
        enabled: true,
        fields: [
          { canonicalPath: "participants.minimumAge" },
          {
            canonicalPath: "participants.fitnessLevel",
            hidden: true,
            defaultValue: "high",
          },
        ],
      },
    ]);
    const gate = { seedLabel: "", fieldOverlays: overlays };
    const result = buildDenaliCreatePrefilledForm(gate, (draft, prefillGate) =>
      applyWizardTemplatePrefillToDraft(
        draft,
        prefillGate.seedLabel,
        prefillGate.fieldOverlays,
        "denali",
        denali
      )
    );
    assert.equal(getCanonicalValue(result, "participants.fitnessLevel"), "high");
  });
});
