import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDenaliTourCreateDefaultValues,
  DENALI_WIZARD_TEST_DESTINATION_ID,
} from "./denaliCore.schema";

test("buildDenaliTourCreateDefaultValues exposes wizard basicInfo defaults", () => {
  const values = buildDenaliTourCreateDefaultValues();
  assert.equal(typeof values.basicInfo.title, "string");
});

test("DENALI_WIZARD_TEST_DESTINATION_ID is a stable UUID fixture", () => {
  assert.match(DENALI_WIZARD_TEST_DESTINATION_ID, /^[0-9a-f-]{36}$/i);
});
