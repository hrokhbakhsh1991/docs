import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_WIZARD_DRAFT_INITIAL_VERSION } from "./tour-wizard-draft.client";

test("TOUR_WIZARD_DRAFT_INITIAL_VERSION is 1 for first PATCH generation", () => {
  assert.equal(TOUR_WIZARD_DRAFT_INITIAL_VERSION, 1);
});
