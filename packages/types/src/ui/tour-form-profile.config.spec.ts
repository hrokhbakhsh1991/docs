import assert from "node:assert/strict";
import test from "node:test";
import { TOUR_FORM_PROFILE_VALUES } from "../tour-form-profile";
import {
  getTourFormProfileOptions,
  getTourFormProfileZodEnumValues,
  TOUR_FORM_PROFILE_SETTINGS_LABEL_PREFIX,
} from "./tour-form-profile.config";

test("getTourFormProfileOptions covers TOUR_FORM_PROFILE_VALUES with settings label keys", () => {
  const options = getTourFormProfileOptions();
  assert.equal(options.length, TOUR_FORM_PROFILE_VALUES.length);
  for (let i = 0; i < TOUR_FORM_PROFILE_VALUES.length; i++) {
    const profile = TOUR_FORM_PROFILE_VALUES[i]!;
    const row = options[i]!;
    assert.equal(row.value, profile);
    assert.equal(row.labelKey, `${TOUR_FORM_PROFILE_SETTINGS_LABEL_PREFIX}${profile}`);
  }
});

test("getTourFormProfileZodEnumValues matches TOUR_FORM_PROFILE_VALUES", () => {
  assert.deepEqual([...getTourFormProfileZodEnumValues()], [...TOUR_FORM_PROFILE_VALUES]);
});
