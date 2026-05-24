import assert from "node:assert/strict";
import test from "node:test";

import { validateDenaliCanonicalTemplateData } from "./validateCanonicalTemplateData";

test("validateDenaliCanonicalTemplateData accepts partial canonical payload", () => {
  const result = validateDenaliCanonicalTemplateData({
    category: "mountain",
    duration: "single",
    title: "Template",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.title, "Template");
  }
});

test("validateDenaliCanonicalTemplateData rejects unknown top-level keys", () => {
  const result = validateDenaliCanonicalTemplateData({
    title: "x",
    legacyOverview: { title: "nope" },
  });
  assert.equal(result.ok, false);
});
