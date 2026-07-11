/**
 * INV-WIZ-014 — Settings wizard template save error resolution
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveWizardTemplateUserError,
  WizardTemplateSaveError,
  WIZARD_TEMPLATE_MESSAGE_KEYS,
} from "../src/features/settings/wizard-template-copy";

describe("wizard-template-copy.spec.ts — INV-WIZ-014", () => {
  it("WEB-WIZ-014 resolves SETTINGS_WIZARD_ENGINE_PLAN_GAP with path and stepId", () => {
    const error = new WizardTemplateSaveError(
      {
        code: "SETTINGS_WIZARD_ENGINE_PLAN_GAP",
        stepId: "denali_basic",
        canonicalPath: "endDateTime",
      },
      400
    );
    const resolution = resolveWizardTemplateUserError(error);
    assert.equal(resolution.type, "key");
    if (resolution.type !== "key") {
      return;
    }
    assert.equal(resolution.key, WIZARD_TEMPLATE_MESSAGE_KEYS.errors.enginePlanGap);
    assert.deepEqual(resolution.values, {
      path: "endDateTime",
      stepId: "denali_basic",
    });
  });

  it("WEB-WIZ-014 resolves generic save HTTP status from WizardTemplateSaveError", () => {
    const error = new WizardTemplateSaveError({ code: "SETTINGS_VALIDATION" }, 422);
    const resolution = resolveWizardTemplateUserError(error);
    assert.equal(resolution.type, "key");
    if (resolution.type !== "key") {
      return;
    }
    assert.equal(resolution.key, WIZARD_TEMPLATE_MESSAGE_KEYS.errors.saveHttp);
    assert.deepEqual(resolution.values, { status: "422" });
  });
});
