import assert from "node:assert/strict";
import test from "node:test";

import {
  TOUR_FORM_PROFILE_VALUES,
  getRequiredSubmitFieldPathsForProfile,
} from "@repo/types";

import { requiredFieldsForProfile } from "./validation";

/**
 * Cross-package parity: wizard `validateForSubmit` required set must match
 * `@repo/types` submit-required derivation (API `assertProfileRequiredFieldsForSubmit`).
 */
test("submit required paths: web requiredFieldsForProfile === @repo/types for every profile", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const fromWeb = [...requiredFieldsForProfile(profile)].sort((a, b) => a.localeCompare(b));
    const fromTypes = [...getRequiredSubmitFieldPathsForProfile(profile)].sort((a, b) =>
      a.localeCompare(b),
    );
    assert.deepEqual(
      fromTypes,
      fromWeb,
      `required submit paths diverged for profile ${profile}`,
    );
  }
});
