import assert from "node:assert/strict";
import test from "node:test";

import { resolveStoredTemplateCanonical } from "./resolve-stored-template-canonical";

test("resolveStoredTemplateCanonical accepts partial valid canonical payload", () => {
  const result = resolveStoredTemplateCanonical({
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: "Template",
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.canonicalData.title, "Template");
  }
});

test("resolveStoredTemplateCanonical rejects top-level fossil keys (no silent strip)", () => {
  const result = resolveStoredTemplateCanonical({
    canonicalData: {
      title: "Kept",
      tripDetails: { overview: { peakHeight: 5610 } },
      overview: { peakHeight: 4100 },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "tripDetails"));
  }
});

test("resolveStoredTemplateCanonical rejects nested strict schema violations", () => {
  const result = resolveStoredTemplateCanonical({
    canonicalData: {
      overview: { denaliTourKind: "mountain_day" },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path.includes("denaliTourKind") || issue.path.startsWith("overview."),
      ),
    );
  }
});
