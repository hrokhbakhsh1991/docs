import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalToTemplate,
  collectDiscardedTemplateKeys,
  sanitizeDenaliCanonicalTemplateData,
  storedTemplateRowIsLegacy,
  templateToCanonical,
} from "./templateCanonicalMapping";

test("templateToCanonical ignores legacy defaults and strips unknown canonical keys", () => {
  const canonical = templateToCanonical({
    canonicalData: {
      title: "Kept",
      overview: { title: "legacy nested" },
    },
    defaults: { overview: { title: "must not merge" } },
    fieldRulesOverlay: { "basicInfo.title": { visibility: "hidden" } },
  });

  assert.equal(canonical.title, "Kept");
  assert.equal((canonical as Record<string, unknown>).overview, undefined);
});

test("canonicalToTemplate returns schema-stamped canonical-only record", () => {
  const record = canonicalToTemplate(
    { category: "mountain", duration: "single", title: "T" },
    { name: "Mountain day" },
  );
  assert.equal(record.name, "Mountain day");
  assert.equal(record.schemaVersion, "1.1.0");
  assert.equal(record.canonicalData.title, "T");
});

test("storedTemplateRowIsLegacy detects legacy defaults", () => {
  assert.equal(
    storedTemplateRowIsLegacy({ canonicalData: {}, defaults: { overview: { title: "x" } } }),
    true,
  );
  assert.equal(storedTemplateRowIsLegacy({ canonicalData: { title: "ok" } }), false);
});

test("collectDiscardedTemplateKeys lists unknown roots", () => {
  assert.deepEqual(collectDiscardedTemplateKeys({ title: "a", tripDetails: {} }), ["tripDetails"]);
});

test("sanitizeDenaliCanonicalTemplateData is idempotent", () => {
  const once = sanitizeDenaliCanonicalTemplateData({ title: "a", legacy: 1 });
  const twice = sanitizeDenaliCanonicalTemplateData(once);
  assert.deepEqual(once, twice);
});
