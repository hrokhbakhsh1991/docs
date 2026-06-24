import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDenaliWizardTemplateLongDescriptionVisible,
  patchDenaliWizardTemplateLongDescriptionVisibility,
} from "@app-tour/workspace-denali/settings/wizard-template-long-description";
import { buildWizardTemplatePutBody, parseWizardTemplateResponse } from "../src/features/settings/wizard-template-logic";

describe("wizard-template-long-description.spec.ts", () => {
  it("WEB-TPL-LD-01 settings toggle round-trips through put body", () => {
    const hidden = patchDenaliWizardTemplateLongDescriptionVisibility({}, false);
    const body = buildWizardTemplatePutBody({
      seedLabel: "seed",
      sections: [],
      published: true,
      fieldRulesOverlay: hidden,
      steps: [
        {
          stepId: "denali_photos",
          label: "Photos",
          enabled: true,
          fields: [{ canonicalPath: "program.themeIds" }],
        },
      ],
    });
    const payload = body.payload as Record<string, unknown>;
    assert.deepEqual(payload.fieldRulesOverlay, hidden);
    assert.equal(isDenaliWizardTemplateLongDescriptionVisible(payload.fieldRulesOverlay as Record<string, unknown>), false);

    const parsed = parseWizardTemplateResponse({
      configKey: "wizard_template",
      configVersion: 1,
      source: "tenant",
      updatedAt: null,
      payload: payload as never,
    });
    assert.equal(isDenaliWizardTemplateLongDescriptionVisible(parsed.fieldRulesOverlay), false);
  });
});
