import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertCanonicalDocument } from "@app-tour/workspace-sdk";

import { resolveCanonicalRootsFromData } from "../src/tours/build-clone-tour-body";
import { mergeCanonicalPatchDataForWorkspace } from "../src/tours/workspace-tour-write-dispatch";

/**
 * ED-PATCH-01 — flat-edit PATCH sends wizard roots without legacy list keys;
 * shallow merge preserves `basics`/`details`/`publishStatus` on stored tours.
 */
describe("canonical-patch-roots-after-merge.spec.ts — ED-PATCH-01", () => {
  it("recomputes roots from merged data so legacy basics survives wizard-shaped PATCH", () => {
    const existing = {
      title: "North Ridge Trek",
      basics: { title: "North Ridge Trek" },
      details: { summary: "Operator smoke seed tour" },
      publishStatus: "active",
      capacityMax: 12,
      program: { shortDescription: "smoke" },
    };
    const patch = {
      title: "North Ridge Trek",
      capacityMax: 13,
      program: { shortDescription: "smoke", difficultyLevel: 6 },
      denali_basic: {},
    };
    const clientRoots = ["title", "capacityMax", "program", "denali_basic"];

    const merged = mergeCanonicalPatchDataForWorkspace("denali", existing, patch);
    assert.equal((merged.basics as { title?: string }).title, "North Ridge Trek");
    assert.equal(merged.publishStatus, "active");
    assert.equal(merged.capacityMax, 13);

    assert.throws(() => {
      assertCanonicalDocument({
        schemaVersion: 1,
        roots: clientRoots,
        data: merged,
      });
    }, /CANONICAL_ROOT_UNKNOWN|basics/);

    const roots = resolveCanonicalRootsFromData(merged);
    assert.ok(roots.includes("basics"));
    assert.ok(roots.includes("details"));
    assert.ok(roots.includes("publishStatus"));
    assert.deepEqual([...roots].sort(), Object.keys(merged).sort());

    assert.doesNotThrow(() => {
      assertCanonicalDocument({
        schemaVersion: 1,
        roots,
        data: merged,
      });
    });
  });
});
