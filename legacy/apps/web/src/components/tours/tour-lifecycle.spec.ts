import assert from "node:assert/strict";
import test from "node:test";

import {
  apiLifecycleToFormStatus,
  formLifecycleToApi,
  lifecycleDisplayLabel,
} from "./tour-lifecycle";

test("apiLifecycleToFormStatus maps API enum to form filter values", () => {
  assert.equal(apiLifecycleToFormStatus("DRAFT"), "draft");
  assert.equal(apiLifecycleToFormStatus("OPEN"), "active");
  assert.equal(apiLifecycleToFormStatus("CLOSED"), "archived");
  assert.equal(apiLifecycleToFormStatus("CANCELLED"), "archived");
});

test("formLifecycleToApi maps form values to API enum for PATCH", () => {
  assert.equal(formLifecycleToApi("draft"), "DRAFT");
  assert.equal(formLifecycleToApi("active"), "OPEN");
  assert.equal(formLifecycleToApi("archived"), "CLOSED");
});

test("lifecycleDisplayLabel returns human labels", () => {
  assert.equal(lifecycleDisplayLabel("draft"), "Draft");
  assert.equal(lifecycleDisplayLabel("active"), "Active");
  assert.equal(lifecycleDisplayLabel("archived"), "Archived");
});
