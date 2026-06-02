import assert from "node:assert/strict";
import test from "node:test";

import { resolveStoredTemplateCanonical } from "./resolveStoredTemplateCanonical";

test("resolveStoredTemplateCanonical rejects non-object canonicalData", () => {
  const result = resolveStoredTemplateCanonical({
    canonicalData: "not-an-object",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.issues[0]?.path, "<root>");
  }
});

test("resolveStoredTemplateCanonical rejects top-level fossil keys before validation", () => {
  const result = resolveStoredTemplateCanonical({
    canonicalData: {
      title: "Valid",
      tripDetails: { rogue: true },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "tripDetails"));
  }
});
