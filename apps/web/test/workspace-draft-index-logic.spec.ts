/**
 * Phase 11.9 — workspace draft index summary logic (WEB-P11-9-03)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWorkspaceDraftIndexCount } from "../src/draft/workspace-draft-index-logic";
import type { WorkspaceDraftIndexItem } from "../src/draft/workspace-draft-types";

const sampleItem = (draftKey: string): WorkspaceDraftIndexItem => ({
  draftNamespace: "operator.wizard",
  draftKey,
  version: 1,
  schemaVersion: 1,
  lastModified: 1,
  updatedAt: "2026-06-11T00:00:00.000Z",
});

describe("workspace-draft-index-logic.spec.ts — Phase 11.9", () => {
  it("WEB-P11-9-03 returns zero when no drafts", () => {
    assert.equal(resolveWorkspaceDraftIndexCount([]), 0);
  });

  it("WEB-P11-9-03 counts other draft keys when current key is excluded", () => {
    const items = [sampleItem("denali-create"), sampleItem("settings-hub")];
    assert.equal(resolveWorkspaceDraftIndexCount(items, "denali-create"), 1);
  });

  it("WEB-P11-9-03 falls back to total when only current draft exists", () => {
    const items = [sampleItem("denali-create")];
    assert.equal(resolveWorkspaceDraftIndexCount(items, "denali-create"), 1);
  });
});
