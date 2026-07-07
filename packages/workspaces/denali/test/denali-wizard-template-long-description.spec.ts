import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDenaliWizardTemplateLongDescriptionVisible,
  patchDenaliWizardTemplateLongDescriptionVisibility,
} from "../src/settings/denali-wizard-template-long-description";

describe("denali-wizard-template-long-description.spec.ts", () => {
  it("DENALI-TPL-LD-01 defaults to visible when overlay absent", () => {
    assert.equal(isDenaliWizardTemplateLongDescriptionVisible(undefined), true);
    assert.equal(isDenaliWizardTemplateLongDescriptionVisible({}), true);
  });

  it("DENALI-TPL-LD-02 hidden overlay hides long description", () => {
    const overlay = { "program.longDescription": { visibility: "hidden" } };
    assert.equal(isDenaliWizardTemplateLongDescriptionVisible(overlay), false);
  });

  it("DENALI-TPL-LD-03 patch toggles overlay key", () => {
    const hidden = patchDenaliWizardTemplateLongDescriptionVisibility({}, false);
    assert.deepEqual(hidden, { "program.longDescription": { visibility: "hidden" } });

    const visible = patchDenaliWizardTemplateLongDescriptionVisibility(hidden, true);
    assert.deepEqual(visible, {});
  });
});
