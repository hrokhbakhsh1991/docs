import assert from "node:assert/strict";
import test from "node:test";

import {
  suggestDenaliTemplateStoragePath,
  validateDenaliCanonicalTemplateData,
} from "./validateCanonicalTemplateData";

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

test("validateDenaliCanonicalTemplateData accepts nested overview partial", () => {
  const result = validateDenaliCanonicalTemplateData({
    overview: { peakHeight: 5610 },
  });
  assert.equal(result.ok, true);
});

test("validateDenaliCanonicalTemplateData rejects tripDetails root with canonical hint", () => {
  const result = validateDenaliCanonicalTemplateData({
    title: "x",
    tripDetails: { overview: { peakHeight: 5610 } },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "tripDetails"));
    assert.ok(
      result.issues.some((issue) => issue.message.includes("overview.peakHeight")),
    );
  }
});

test("validateDenaliCanonicalTemplateData rejects unknown nested program keys", () => {
  const result = validateDenaliCanonicalTemplateData({
    program: { shortDescription: "ok", unknownSlice: true },
  });
  assert.equal(result.ok, false);
});

test("suggestDenaliTemplateStoragePath maps legacy RHF-shaped paths", () => {
  assert.equal(
    suggestDenaliTemplateStoragePath("tripDetails.overview.peakHeight"),
    "overview.peakHeight",
  );
  assert.equal(suggestDenaliTemplateStoragePath("basicInfo.title"), "title");
});
