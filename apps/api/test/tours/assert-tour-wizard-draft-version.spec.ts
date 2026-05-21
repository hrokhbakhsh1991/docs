import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  assertTourWizardDraftVersionMatch,
  TOUR_WIZARD_DRAFT_INITIAL_VERSION,
} from "../../src/modules/tours/utils/assert-tour-wizard-draft-version";

test("assertTourWizardDraftVersionMatch allows matching versions", () => {
  assert.doesNotThrow(() => assertTourWizardDraftVersionMatch(3, 3));
});

test("assertTourWizardDraftVersionMatch throws 409 on mismatch", () => {
  assert.throws(
    () => assertTourWizardDraftVersionMatch(4, 3),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "TOUR_WIZARD_DRAFT_STALE");
      return true;
    },
  );
});

test("TOUR_WIZARD_DRAFT_INITIAL_VERSION is 1", () => {
  assert.equal(TOUR_WIZARD_DRAFT_INITIAL_VERSION, 1);
});
