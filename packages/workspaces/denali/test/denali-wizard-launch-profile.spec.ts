import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listDenaliLaunchHiddenWizardCategories,
  resolveDenaliWizardCategoryChoices,
} from "../src/ui/logic/denali-wizard-launch-profile";

describe("denali-wizard-launch-profile.spec.ts", () => {
  it("STG-P1-005 launch wizard hides event category", () => {
    const choices = resolveDenaliWizardCategoryChoices();
    assert.deepEqual(choices, ["mountain", "nature", "desert"]);
    assert.equal(choices.includes("event"), false);
  });

  it("STG-P1-005 hidden categories include event only", () => {
    assert.deepEqual(listDenaliLaunchHiddenWizardCategories(), ["event"]);
  });
});
