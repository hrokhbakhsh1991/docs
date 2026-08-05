import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCreateTourSubmitDisabled,
  resolveCreateTourSubmitButtonKind,
  shouldShowWizardTemplateSeedBanner,
} from "../src/wizard/create-tour-wizard-chrome-logic";

describe("create-tour-wizard-chrome-logic", () => {
  it("WEB-WIZ-SEED-01 hides seed banner when draft title diverges from seedLabel", () => {
    assert.equal(
      shouldShowWizardTemplateSeedBanner({
        seedLabel: "nature-multi-audit",
        draftTitle: "nature-multi-audit",
      }),
      true
    );
    assert.equal(
      shouldShowWizardTemplateSeedBanner({
        seedLabel: "nature-multi-audit",
        draftTitle: "",
      }),
      true
    );
    assert.equal(
      shouldShowWizardTemplateSeedBanner({
        seedLabel: "nature-multi-audit",
        draftTitle: "ممیزی طبیعت چندروزه",
      }),
      false
    );
    assert.equal(shouldShowWizardTemplateSeedBanner({ seedLabel: "" }), false);
  });

  it("WEB-WIZ-CREATE-01 prefers createButton over creating once tour id exists", () => {
    assert.equal(
      resolveCreateTourSubmitButtonKind({ createdTourId: "tour-1", pending: true }),
      "createButton"
    );
    assert.equal(
      resolveCreateTourSubmitButtonKind({ createdTourId: null, pending: true }),
      "creating"
    );
    assert.equal(
      resolveCreateTourSubmitButtonKind({ createdTourId: null, pending: false }),
      "createButton"
    );
    assert.equal(
      isCreateTourSubmitDisabled({ createdTourId: "tour-1", pending: false }),
      true
    );
  });
});
