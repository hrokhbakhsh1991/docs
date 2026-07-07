import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform create route", () => {
  it("new club page renders wizard client", () => {
    const page = readFileSync(
      new URL("../app/(platform)/platform/clubs/new/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(page, /CreateClubWizardClient/);
    assert.match(page, /create-club-wizard-client/);
  });

  it("wizard client has 4 steps", () => {
    const wizard = readFileSync(
      new URL("../src/platform/create-club/create-club-wizard-client.tsx", import.meta.url),
      "utf8"
    );
    assert.match(wizard, /StepIdentity/);
    assert.match(wizard, /StepSites/);
    assert.match(wizard, /StepOwner/);
    assert.match(wizard, /StepReview/);
    assert.match(wizard, /Step \{step\} of 4/);
    assert.match(wizard, /STEP_TITLES/);
  });
});
