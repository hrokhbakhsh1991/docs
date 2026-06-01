import assert from "node:assert/strict";
import test from "node:test";

import { isDenaliCanonicalTemplateDataEmpty } from "./isDenaliCanonicalTemplateDataEmpty";

test("isDenaliCanonicalTemplateDataEmpty: true for empty object and null", () => {
  assert.equal(isDenaliCanonicalTemplateDataEmpty({}), true);
  assert.equal(isDenaliCanonicalTemplateDataEmpty(null), true);
  assert.equal(isDenaliCanonicalTemplateDataEmpty(undefined), true);
});

test("isDenaliCanonicalTemplateDataEmpty: false when any top-level field is defined", () => {
  assert.equal(isDenaliCanonicalTemplateDataEmpty({ title: "Tour" }), false);
  assert.equal(isDenaliCanonicalTemplateDataEmpty({ program: {} }), false);
});
