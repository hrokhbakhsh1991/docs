import assert from "node:assert/strict";
import test from "node:test";

import { parseWizardPrefillQuery, wizardPrefillNeedsBootstrap } from "./parseWizardPrefillQuery";

function params(entries: Record<string, string | null>): { get: (n: string) => string | null } {
  return {
    get: (name) => entries[name] ?? null,
  };
}

test("parseWizardPrefillQuery: blank when no query", () => {
  assert.deepEqual(parseWizardPrefillQuery(params({})), { kind: "blank" });
  assert.equal(wizardPrefillNeedsBootstrap({ kind: "blank" }), false);
});

test("parseWizardPrefillQuery: presetId", () => {
  const q = parseWizardPrefillQuery(params({ presetId: "abc-123" }));
  assert.equal(q.kind, "preset");
  if (q.kind === "preset") assert.equal(q.presetId, "abc-123");
});

test("parseWizardPrefillQuery: clone wins over preset", () => {
  const q = parseWizardPrefillQuery(
    params({ clone: "tour-1", presetId: "preset-1" }),
  );
  assert.equal(q.kind, "clone");
  if (q.kind === "clone") assert.equal(q.cloneTourId, "tour-1");
});

test("parseWizardPrefillQuery: trims whitespace", () => {
  const q = parseWizardPrefillQuery(params({ clone: "  uuid  " }));
  assert.equal(q.kind, "clone");
  if (q.kind === "clone") assert.equal(q.cloneTourId, "uuid");
});
