import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliHydrateTourCloneDraft, denaliHydrateTourEditDraft } from "@app-tour/workspace-denali/clone/hydration";

describe("denali tour edit hydrate — Phase 12.2b", () => {
  it("DEN-12.2b-01 edit hydrate preserves title (no copy suffix)", () => {
    const canonical = {
      title: "Alpine trek",
      category: "mountain",
      publishStatus: "published",
    };
    const clone = denaliHydrateTourCloneDraft(canonical);
    const edit = denaliHydrateTourEditDraft(canonical);
    assert.match(String(clone.data.title), /\(Copy\)$/);
    assert.equal(edit.data.title, "Alpine trek");
    assert.equal(edit.data.publishStatus, "published");
  });
});
